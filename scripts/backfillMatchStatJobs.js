// ESEA Tracker — match_stat_jobs backlog backfill (Этап 5, автономность;
// demo_sync добавлен вместе с 0009_match_demo_sync.sql).
//
// One-shot, idempotent seeder. Finds FINISHED matches with
// stats_synced=false / demo_synced=false that don't yet have the
// corresponding job and enqueues them — the existing
// scripts/processMatchStatJobs.js consumer (and the pipelines it spawns:
// autoSyncMatches.js --post-match-only for stats, fetchMatchDemo.js for
// demos) does all the actual fetching/saving. This script contains NO
// fetching logic of its own — it only creates match_stat_jobs rows,
// exactly like worker.js/autoSyncMatches.js already do for newly-finished
// matches, just retroactively for matches that finished before the job
// queue existed (or before this job_type existed).
//
// Safe to run on every cron tick forever: once the backlog is drained, the
// query below returns nothing and the run is a fast no-op — there is no
// separate "idle mode" to build or manage. Duplicate-safe via the same
// unique(match_id, job_type) + ignoreDuplicates upsert pattern already used
// by both existing producers.
//
// Запуск: node scripts/backfillMatchStatJobs.js
// (в GitHub Actions секреты приходят через env: блок workflow; локально —
// node --env-file=.env.local scripts/backfillMatchStatJobs.js)

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are required"
  );
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 500;

const FINISHED_STATUSES = ["FINISHED", "MATCH_STATUS_FINISHED"];

async function fetchFinishedMatchIdsMissing(column) {
  const ids = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("matches")
      .select("id")
      .in("status", FINISHED_STATUSES)
      .eq(column, false)
      .order("finished_at", {
        ascending: true,
        nullsFirst: false,
      })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = data || [];
    ids.push(...page.map((row) => row.id));

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return ids;
}

async function enqueueJobs(matchIds, jobType, extraFields = {}) {
  let created = 0;

  for (
    let index = 0;
    index < matchIds.length;
    index += UPSERT_BATCH_SIZE
  ) {
    const batch = matchIds
      .slice(index, index + UPSERT_BATCH_SIZE)
      .map((matchId) => ({
        match_id: matchId,
        job_type: jobType,
        ...extraFields,
      }));

    const { data, error } = await supabase
      .from("match_stat_jobs")
      .upsert(batch, {
        onConflict: "match_id,job_type",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      throw error;
    }

    // With ignoreDuplicates (ON CONFLICT DO NOTHING), Postgres only
    // RETURNING-s rows that were actually inserted — conflicting
    // (already-queued) rows are silently skipped, not returned. So
    // data.length here is the real "newly created" count, not a guess.
    created += (data || []).length;
  }

  return created;
}

async function main() {
  const statsMatchIds = await fetchFinishedMatchIdsMissing("stats_synced");

  const statsCreated =
    statsMatchIds.length > 0
      ? await enqueueJobs(statsMatchIds, "stats_sync")
      : 0;

  // demo_sync — same backlog-drain pattern as stats_sync above, just keyed
  // off matches.demo_synced (see 0009_match_demo_sync.sql). Higher
  // max_attempts than the stats_sync default (5), matching the value used
  // by the two live producers (worker.js/autoSyncMatches.js) at
  // FINISHED-transition time.
  const demoMatchIds = await fetchFinishedMatchIdsMissing("demo_synced");

  const demoCreated =
    demoMatchIds.length > 0
      ? await enqueueJobs(demoMatchIds, "demo_sync", { max_attempts: 20 })
      : 0;

  console.log(
    JSON.stringify({
      ok: true,
      stats: {
        candidates: statsMatchIds.length,
        created: statsCreated,
        alreadyQueued: statsMatchIds.length - statsCreated,
      },
      demo: {
        candidates: demoMatchIds.length,
        created: demoCreated,
        alreadyQueued: demoMatchIds.length - demoCreated,
      },
    })
  );
}

main().catch((error) => {
  console.error("[backfill] fatal error:", error);
  process.exit(1);
});
