// ESEA Tracker — match_stat_jobs consumer (Этап 5).
//
// Единственная задача: забрать due-задачи из match_stat_jobs, запустить уже
// существующий post-match pipeline (autoSyncMatches.js --post-match-only —
// syncFinishedLineups/syncFinishedMapStats/условные рейтинги, без единой
// новой строчки в самой логике получения/сохранения статистики), затем по
// matches.stats_synced определить исход каждой задачи: done / retry / failed.
//
// НЕ содержит собственной логики сбора статистики или пересчёта рейтингов —
// это намеренно, вся эта логика уже есть и уже работает в autoSyncMatches.js.
// match_stat_jobs — ускоряющий слой поверх штатного пайплайна, не замена:
// обычный autoSyncMatches.js по расписанию (sync-matches.yml/sync-live.yml)
// продолжает сам сканировать matches.stats_synced=false независимо от того,
// как отработал этот consumer.
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

function backoffMs(attempts) {
  return Math.min(
    BASE_BACKOFF_MS * 2 ** Math.max(attempts - 1, 0),
    MAX_BACKOFF_MS
  );
}

// Atomic claim via claim_match_stat_jobs() (see migration 0003) — a single
// SQL statement using FOR UPDATE SKIP LOCKED, so two processMatchStatJobs.js
// runs firing at the same time (e.g. a manual workflow_dispatch overlapping
// the cron tick) always get disjoint sets of jobs, never the same one twice.
// This is defense in depth alongside the workflow's own concurrency group.
async function claimDueJobs() {
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

async function resolveJobs(jobs, runResult) {
  const matchIds = [...new Set(jobs.map((job) => job.match_id))];

  const { data: rows, error } = await supabase
    .from("matches")
    .select("id,stats_synced")
    .in("id", matchIds);

  if (error) {
    throw error;
  }

  const syncedById = new Map(
    (rows || []).map((row) => [row.id, row.stats_synced === true])
  );

  let done = 0;
  let retried = 0;
  let failedPermanently = 0;

  for (const job of jobs) {
    const synced = syncedById.get(job.match_id) === true;
    const nowIso = new Date().toISOString();

    if (synced) {
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
    const errorMessage =
      runResult.error ||
      (runResult.code !== 0
        ? `autoSyncMatches.js --post-match-only exited with code ${runResult.code}`
        : "stats_synced still false after post-match-only run");

    if (nextAttempts >= job.max_attempts) {
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

      // Stop syncFinishedMapStats() (autoSyncMatches.js) from rescanning
      // this match on every future run — a job hitting max_attempts means
      // FACEIT has genuinely never returned usable stats for it, so
      // retrying forever would just keep starving newer matches out of
      // the batch. Best-effort: the job itself is already marked failed
      // above regardless of whether this second write succeeds.
      const { error: matchUpdateError } = await supabase
        .from("matches")
        .update({ stats_unavailable: true })
        .eq("id", job.match_id);

      if (matchUpdateError) {
        console.warn(
          `[stat-jobs] failed to flag ${job.match_id} as stats_unavailable: ${matchUpdateError.message}`
        );
      }

      failedPermanently += 1;
      continue;
    }

    const nextAttemptAt = new Date(
      Date.now() + backoffMs(nextAttempts)
    ).toISOString();

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

async function main() {
  const jobs = await claimDueJobs();

  if (jobs.length === 0) {
    console.log(JSON.stringify({ ok: true, claimed: 0, message: "no due jobs" }));
    return;
  }

  console.log(
    `[stat-jobs] claimed ${jobs.length} job(s): ${jobs
      .map((job) => job.match_id)
      .join(", ")}`
  );

  const runResult = await runPostMatchOnly();

  if (runResult.code !== 0) {
    console.warn(
      `[stat-jobs] autoSyncMatches.js --post-match-only exited with code ${runResult.code}` +
        (runResult.error ? ` (${runResult.error})` : "")
    );
  }

  const summary = await resolveJobs(jobs, runResult);

  console.log(
    JSON.stringify({
      ok: true,
      claimed: jobs.length,
      ...summary,
    })
  );
}

main().catch((error) => {
  console.error("[stat-jobs] fatal error:", error);
  process.exit(1);
});
