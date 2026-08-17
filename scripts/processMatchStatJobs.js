// ESEA Tracker — match_stat_jobs consumer (Этап 5, расширено под demo_sync).
//
// Забирает due-задачи из match_stat_jobs (любого job_type) и обрабатывает
// каждую группу своим путём:
//   - stats_sync: запускает уже существующий post-match pipeline
//     (autoSyncMatches.js --post-match-only — syncFinishedLineups/
//     syncFinishedMapStats/условные рейтинги, без единой новой строчки в
//     самой логике получения/сохранения статистики), затем по
//     matches.stats_synced определяет исход: done / retry / failed.
//   - demo_sync: запускает scripts/fetchMatchDemo.js на каждый match_id
//     (см. 0009_match_demo_sync.sql), затем по matches.demo_synced
//     определяет исход тем же способом.
//
// Обе группы резолвятся через один и тот же resolveJobGroup() — done/retry/
// failed-логика идентична, отличаются только имя колонки-флага, колонка
// "matches.*_unavailable" и бэкофф. НЕ содержит собственной логики сбора
// статистики или демок — это уже есть в autoSyncMatches.js/fetchMatchDemo.js,
// этот файл только заводит их по расписанию джобы.
//
// Запуск: node scripts/processMatchStatJobs.js
// (в GitHub Actions секреты приходят через env: блок workflow; локально —
// node --env-file=.env.local scripts/processMatchStatJobs.js)

import { spawn } from "node:child_process";
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

const BATCH_SIZE = Number(process.env.STAT_JOBS_BATCH_SIZE || 20);
const BASE_BACKOFF_MS = Number(
  process.env.STAT_JOBS_BASE_BACKOFF_MS || 30_000
);
const MAX_BACKOFF_MS = Number(
  process.env.STAT_JOBS_MAX_BACKOFF_MS || 3_600_000
);

// Demos routinely take longer than stats to become available at FACEIT —
// separate (higher) base backoff, same cap. Paired with the higher
// max_attempts (20) set at enqueue time in worker.js/autoSyncMatches.js.
const DEMO_JOBS_BASE_BACKOFF_MS = Number(
  process.env.DEMO_JOBS_BASE_BACKOFF_MS || 60_000
);
const DEMO_JOBS_CONCURRENCY = Number(
  process.env.DEMO_JOBS_CONCURRENCY || 5
);

// Visibility only, not a behavior change — this process is short-lived
// (spawned fresh per cycle by statsWorker.js), so a "log every 60s" pattern
// mostly won't fire before it exits. The interval is a safety net for the
// rare long run; the total printed at the end of main() is what actually
// answers "how many Supabase requests per job run" in the common case.
let supabaseRequestCount = 0;
let supabaseRequestsInWindow = 0;

function countSupabaseCall() {
  supabaseRequestCount += 1;
  supabaseRequestsInWindow += 1;
}

setInterval(() => {
  if (supabaseRequestsInWindow > 0) {
    console.log(
      `[processMatchStatJobs] ${supabaseRequestsInWindow} requests to Supabase in the last 60s`
    );
  }
  supabaseRequestsInWindow = 0;
}, 60000).unref();

function backoffMs(attempts, baseMs = BASE_BACKOFF_MS) {
  return Math.min(
    baseMs * 2 ** Math.max(attempts - 1, 0),
    MAX_BACKOFF_MS
  );
}

// Atomic claim via claim_match_stat_jobs() (see migration 0003) — a single
// SQL statement using FOR UPDATE SKIP LOCKED, so two processMatchStatJobs.js
// runs firing at the same time (e.g. a manual workflow_dispatch overlapping
// the cron tick) always get disjoint sets of jobs, never the same one twice.
// This is defense in depth alongside the workflow's own concurrency group.
// Not filtered by job_type — claims whatever is due, of any type.
async function claimDueJobs() {
  countSupabaseCall();
  const { data: dueJobs, error } = await supabase.rpc(
    "claim_match_stat_jobs",
    { p_batch_size: BATCH_SIZE }
  );

  if (error) {
    throw error;
  }

  return dueJobs || [];
}

function runPostMatchOnly() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["scripts/autoSyncMatches.js", "--post-match-only"],
      {
        stdio: "inherit",
        shell: false,
        env: process.env,
      }
    );

    child.on("error", (error) => {
      resolve({ code: null, error: error.message });
    });

    child.on("exit", (code) => {
      resolve({ code, error: null });
    });
  });
}

function runFetchMatchDemo(matchId) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["scripts/fetchMatchDemo.js", matchId],
      {
        stdio: "inherit",
        shell: false,
        env: process.env,
      }
    );

    child.on("error", (error) => {
      resolve({ code: null, error: error.message });
    });

    child.on("exit", (code) => {
      resolve({ code, error: null });
    });
  });
}

// Bounded-concurrency runner for demo_sync — unlike stats_sync (one shared
// pipeline run covers the whole claimed batch), each demo job is an
// independent per-match subprocess, so results are tracked per match_id.
async function runDemoJobs(matchIds) {
  const results = new Map();
  let cursor = 0;

  async function worker() {
    while (cursor < matchIds.length) {
      const index = cursor++;
      const matchId = matchIds[index];
      results.set(matchId, await runFetchMatchDemo(matchId));
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(DEMO_JOBS_CONCURRENCY, matchIds.length) },
      worker
    )
  );

  return results;
}

// Shared done/retry/failed resolution for a group of same-job_type jobs.
// column/unavailableColumn are matches.* flags checked after the run;
// errorMessageFor(job) supplies the last_error text for a job that's still
// not synced (differs between stats_sync — one shared runResult for the
// whole batch — and demo_sync — one result per match_id).
async function resolveJobGroup(
  jobs,
  { column, unavailableColumn, baseBackoffMs, errorMessageFor }
) {
  if (jobs.length === 0) {
    return { done: 0, retried: 0, failedPermanently: 0 };
  }

  const matchIds = [...new Set(jobs.map((job) => job.match_id))];

  countSupabaseCall();
  const { data: rows, error } = await supabase
    .from("matches")
    .select(`id,${column}`)
    .in("id", matchIds);

  if (error) {
    throw error;
  }

  const syncedById = new Map(
    (rows || []).map((row) => [row.id, row[column] === true])
  );

  let done = 0;
  let retried = 0;
  let failedPermanently = 0;

  for (const job of jobs) {
    const synced = syncedById.get(job.match_id) === true;
    const nowIso = new Date().toISOString();

    if (synced) {
      countSupabaseCall();
      const { error: updateError } = await supabase
        .from("match_stat_jobs")
        .update({
          status: "done",
          completed_at: nowIso,
          updated_at: nowIso,
          last_error: null,
        })
        .eq("id", job.id);

      if (updateError) {
        throw updateError;
      }

      done += 1;
      continue;
    }

    const nextAttempts = job.attempts + 1;
    const errorMessage = errorMessageFor(job);

    if (nextAttempts >= job.max_attempts) {
      countSupabaseCall();
      const { error: updateError } = await supabase
        .from("match_stat_jobs")
        .update({
          status: "failed",
          attempts: nextAttempts,
          last_error: errorMessage,
          updated_at: nowIso,
        })
        .eq("id", job.id);

      if (updateError) {
        throw updateError;
      }

      // Stop the corresponding backlog scan (syncFinishedMapStats() for
      // stats, backfillMatchStatJobs.js's demo pass for demos) from
      // rescanning this match forever — hitting max_attempts means FACEIT
      // has genuinely never returned usable data for it (stats 404s,
      // forfeited match with no demo, etc). Best-effort: the job itself is
      // already marked failed above regardless of whether this write
      // succeeds.
      countSupabaseCall();
      const { error: matchUpdateError } = await supabase
        .from("matches")
        .update({ [unavailableColumn]: true })
        .eq("id", job.match_id);

      if (matchUpdateError) {
        console.warn(
          `[stat-jobs] failed to flag ${job.match_id} as ${unavailableColumn}: ${matchUpdateError.message}`
        );
      }

      failedPermanently += 1;
      continue;
    }

    const nextAttemptAt = new Date(
      Date.now() + backoffMs(nextAttempts, baseBackoffMs)
    ).toISOString();

    countSupabaseCall();
    const { error: updateError } = await supabase
      .from("match_stat_jobs")
      .update({
        status: "pending",
        attempts: nextAttempts,
        next_attempt_at: nextAttemptAt,
        last_error: errorMessage,
        updated_at: nowIso,
      })
      .eq("id", job.id);

    if (updateError) {
      throw updateError;
    }

    retried += 1;
  }

  return { done, retried, failedPermanently };
}

function logSupabaseRequestTotal() {
  console.log(
    `[processMatchStatJobs] ${supabaseRequestCount} requests to Supabase this run`
  );
}

async function main() {
  const jobs = await claimDueJobs();

  if (jobs.length === 0) {
    console.log(JSON.stringify({ ok: true, claimed: 0, message: "no due jobs" }));
    logSupabaseRequestTotal();
    return;
  }

  const statsJobs = jobs.filter((job) => job.job_type === "stats_sync");
  const demoJobs = jobs.filter((job) => job.job_type === "demo_sync");

  console.log(
    `[stat-jobs] claimed ${jobs.length} job(s) — stats_sync=${statsJobs.length} demo_sync=${demoJobs.length}: ${jobs
      .map((job) => `${job.match_id}:${job.job_type}`)
      .join(", ")}`
  );

  let statsSummary = { done: 0, retried: 0, failedPermanently: 0 };
  let demoSummary = { done: 0, retried: 0, failedPermanently: 0 };

  if (statsJobs.length > 0) {
    const runResult = await runPostMatchOnly();

    if (runResult.code !== 0) {
      console.warn(
        `[stat-jobs] autoSyncMatches.js --post-match-only exited with code ${runResult.code}` +
          (runResult.error ? ` (${runResult.error})` : "")
      );
    }

    statsSummary = await resolveJobGroup(statsJobs, {
      column: "stats_synced",
      unavailableColumn: "stats_unavailable",
      baseBackoffMs: BASE_BACKOFF_MS,
      errorMessageFor: () =>
        runResult.error ||
        (runResult.code !== 0
          ? `autoSyncMatches.js --post-match-only exited with code ${runResult.code}`
          : "stats_synced still false after post-match-only run"),
    });
  }

  if (demoJobs.length > 0) {
    const demoMatchIds = [...new Set(demoJobs.map((job) => job.match_id))];
    const demoResults = await runDemoJobs(demoMatchIds);

    demoSummary = await resolveJobGroup(demoJobs, {
      column: "demo_synced",
      unavailableColumn: "demo_unavailable",
      baseBackoffMs: DEMO_JOBS_BASE_BACKOFF_MS,
      errorMessageFor: (job) => {
        const result = demoResults.get(job.match_id) || { code: null, error: null };
        return (
          result.error ||
          (result.code !== 0
            ? `fetchMatchDemo.js exited with code ${result.code}`
            : "demo_synced still false after fetchMatchDemo.js run")
        );
      },
    });
  }

  console.log(
    JSON.stringify({
      ok: true,
      claimed: jobs.length,
      stats: statsSummary,
      demo: demoSummary,
    })
  );

  logSupabaseRequestTotal();
}

main().catch((error) => {
  console.error("[stat-jobs] fatal error:", error);
  logSupabaseRequestTotal();
  process.exit(1);
});
