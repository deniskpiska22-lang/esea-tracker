// ESEA Tracker — match_stat_jobs backlog backfill (Этап 5, автономность).
//
// One-shot, idempotent seeder. Finds FINISHED matches with
// stats_synced=false that don't yet have a stats_sync job and enqueues
// them — the existing scripts/processMatchStatJobs.js consumer (and the
// unchanged autoSyncMatches.js --post-match-only pipeline it spawns) does
// all the actual stats fetching/saving. This script contains NO
// stats-fetching logic of its own — it only creates match_stat_jobs rows,
// exactly like worker.js/autoSyncMatches.js already do for newly-finished
// matches, just retroactively for matches that finished before the job
// queue existed.
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

async function fetchUnsyncedFinishedMatchIds() {
  const ids = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("matches")
      .select("id")
      .in("status", FINISHED_STATUSES)
      .eq("stats_synced", false)
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

async function enqueueJobs(matchIds) {
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
        job_type: "stats_sync",
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
  const matchIds = await fetchUnsyncedFinishedMatchIds();

  if (matchIds.length === 0) {
    console.log(
      JSON.stringify({
        ok: true,
        candidates: 0,
        created: 0,
        message: "backlog empty",
      })
    );
    return;
  }

  const created = await enqueueJobs(matchIds);

  console.log(
    JSON.stringify({
      ok: true,
      candidates: matchIds.length,
      created,
      alreadyQueued: matchIds.length - created,
    })
  );
}

main().catch((error) => {
  console.error("[backfill] fatal error:", error);
  process.exit(1);
});
