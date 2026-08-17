// ESEA Tracker — постоянный Stats Worker (Railway, отдельный сервис).
//
// Единственная задача: забирать due match_stat_jobs и запускать существующий,
// немодифицированный scripts/processMatchStatJobs.js — claim ->
// autoSyncMatches.js --post-match-only -> done/retry/failed по
// matches.stats_synced. Никакой собственной логики получения/сохранения
// статистики или парсинга FACEIT здесь нет и не должно быть — это уже есть и
// работает в processMatchStatJobs.js / autoSyncMatches.js, этот файл только
// решает, КОГДА его запускать.
//
// Раньше решал "когда" фиксированным интервалом (45с, безусловно, вне
// зависимости от того, есть ли вообще due-задачи). Теперь — событийно:
// Realtime-подписка на INSERT в match_stat_jobs (см. миграцию
// 0015_match_stat_jobs_realtime.sql) запускает цикл почти сразу после
// появления новой задачи. Fallback-поллинг (60с) остаётся отдельно и нужен
// именно для retry-задач — они становятся due позже по next_attempt_at
// (backoff после неудачной попытки), это не INSERT, Realtime его не увидит.
//
// Отдельный процесс (не встроенный тик в worker.js): live-тик (~7с) и
// многоминутный прогон обработки статистики не должны делить один event
// loop — здесь у стата своя лента, у live-обновлений своя, оба работают
// на Railway независимо друг от друга (см. railway.stats-worker.json).
//
// Запуск: node scripts/statsWorker.js
// (в Railway секреты приходят из переменных окружения сервиса; локально —
// node --env-file=.env.local scripts/statsWorker.js)

import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are required"
  );
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Safety net for retry jobs (see header comment) — the only thing keeping
// them moving when Realtime is quiet.
const FALLBACK_POLL_INTERVAL_MS = Number(
  process.env.STATS_WORKER_FALLBACK_POLL_INTERVAL_MS || 60000
);

// Раз в BACKFILL_EVERY_N_CYCLES фактически выполненных циклов также
// запускаем backfillMatchStatJobs.js — дешёвый идемпотентный no-op, если
// backlog уже заведён в очередь, но ловит матчи, которые почему-то не
// получили job ни от worker.js, ни от autoSyncMatches.js (defense in
// depth, тот же принцип, что и раньше у process-stat-jobs.yml). "Цикл"
// теперь считается по фактическим запускам claim'а (Realtime-триггер или
// fallback-тик), а не по тикам таймера с фиксированной частотой.
const BACKFILL_EVERY_N_CYCLES = Number(
  process.env.STATS_WORKER_BACKFILL_EVERY_N_CYCLES || 20
);

// worker_status: та же логика троттлинга, что и в worker.js — пишем только
// при смене статуса или не чаще раза в WORKER_STATUS_MIN_INTERVAL_MS.
const WORKER_STATUS_MIN_INTERVAL_MS = Number(
  process.env.WORKER_STATUS_MIN_INTERVAL_MS || 30000
);

// Backoff/circuit breaker for the Supabase calls this process makes
// directly (worker_status upserts, the Realtime subscription). The actual
// claim/job work happens in a spawned child (processMatchStatJobs.js) — its
// exit code feeds into this same backoff state, since a non-zero exit there
// is, in practice, almost always a Supabase problem (claim_match_stat_jobs
// RPC or a subsequent write failing).
const SUPABASE_BASE_BACKOFF_MS = Number(
  process.env.SUPABASE_BASE_BACKOFF_MS || FALLBACK_POLL_INTERVAL_MS
);
const SUPABASE_MAX_BACKOFF_MS = Number(
  process.env.SUPABASE_MAX_BACKOFF_MS || 300000 // 5 min ceiling
);
const SUPABASE_CIRCUIT_BREAKER_THRESHOLD = Number(
  process.env.SUPABASE_CIRCUIT_BREAKER_THRESHOLD || 5
);
const SUPABASE_CIRCUIT_BREAKER_COOLDOWN_MS = Number(
  process.env.SUPABASE_CIRCUIT_BREAKER_COOLDOWN_MS || 600000 // 10 min
);
const SUPABASE_CALL_TIMEOUT_MS = Number(
  process.env.SUPABASE_CALL_TIMEOUT_MS || 15000
);

function formatError(error) {
  return error?.message || String(error);
}

function runScript(scriptPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      shell: false,
      env: process.env,
    });

    child.on("error", (error) => {
      resolve({ code: null, error: formatError(error) });
    });

    child.on("exit", (code) => {
      resolve({ code, error: null });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Supabase call budget: backoff, circuit breaker, request counter -----
let supabaseConsecutiveErrors = 0;
let supabaseBackoffMs = SUPABASE_BASE_BACKOFF_MS;
let supabaseCircuitOpenUntil = 0;
let supabaseRequestsInWindow = 0;

function supabaseCircuitBreakerOpen() {
  return Date.now() < supabaseCircuitOpenUntil;
}

function recordSupabaseSuccess() {
  supabaseConsecutiveErrors = 0;
  supabaseBackoffMs = SUPABASE_BASE_BACKOFF_MS;
}

function recordSupabaseFailure() {
  supabaseConsecutiveErrors += 1;
  supabaseBackoffMs = Math.min(supabaseBackoffMs * 2, SUPABASE_MAX_BACKOFF_MS);

  console.warn(
    `[stats-worker] Supabase call failed (${supabaseConsecutiveErrors} in a row), ` +
      `next backoff ${supabaseBackoffMs}ms`
  );

  if (supabaseConsecutiveErrors >= SUPABASE_CIRCUIT_BREAKER_THRESHOLD) {
    supabaseCircuitOpenUntil = Date.now() + SUPABASE_CIRCUIT_BREAKER_COOLDOWN_MS;
    console.warn(
      `[stats-worker] Supabase circuit breaker OPEN after ${supabaseConsecutiveErrors} ` +
        `consecutive errors — pausing all cycles for ` +
        `${Math.round(SUPABASE_CIRCUIT_BREAKER_COOLDOWN_MS / 1000)}s`
    );
  }
}

// Every direct Supabase call this process makes (worker_status upserts)
// goes through this: counts it, bounds it to SUPABASE_CALL_TIMEOUT_MS, and
// feeds success/failure into the backoff + circuit breaker above. Same
// implementation as worker.js's callSupabase() — see that file for the
// reasoning on the timeout race and the swallowed-rejection guard.
async function callSupabase(fn) {
  supabaseRequestsInWindow += 1;

  const callPromise = Promise.resolve().then(fn);
  callPromise.catch(() => {});

  let timeoutId;

  try {
    const result = await Promise.race([
      callPromise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Supabase call timed out after ${SUPABASE_CALL_TIMEOUT_MS}ms`
            )
          );
        }, SUPABASE_CALL_TIMEOUT_MS);
      }),
    ]);

    if (result && typeof result === "object" && result.error) {
      recordSupabaseFailure();
    } else {
      recordSupabaseSuccess();
    }

    return result;
  } catch (error) {
    recordSupabaseFailure();
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function startSupabaseRequestCounterLog() {
  setInterval(() => {
    console.log(
      `[stats-worker] ${supabaseRequestsInWindow} requests to Supabase in the last 60s`
    );
    supabaseRequestsInWindow = 0;
  }, 60000).unref();
}

// --- worker_status: only written on a real change -------------------------
let lastWorkerStatusValue = null;
let lastWorkerStatusWrittenAt = 0;

async function pingWorkerStatus(status, detail) {
  const now = Date.now();
  const statusChanged = status !== lastWorkerStatusValue;
  const dueForRefresh =
    now - lastWorkerStatusWrittenAt >= WORKER_STATUS_MIN_INTERVAL_MS;

  if (!statusChanged && !dueForRefresh) {
    return;
  }

  // Best-effort, как и во всех остальных heartbeat-точках проекта:
  // отсутствие миграции 0008_worker_status.sql не должно останавливать цикл.
  try {
    await callSupabase(() =>
      supabase.from("worker_status").upsert(
        {
          worker_name: "stats-worker",
          last_ping: new Date().toISOString(),
          status,
          detail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "worker_name" }
      )
    );

    lastWorkerStatusValue = status;
    lastWorkerStatusWrittenAt = now;
  } catch {
    // no-op
  }
}

let cycleCount = 0;

async function runCycleOnce() {
  cycleCount += 1;
  const cycleNumber = cycleCount;

  if (
    BACKFILL_EVERY_N_CYCLES > 0 &&
    cycleNumber % BACKFILL_EVERY_N_CYCLES === 0
  ) {
    const backfillResult = await runScript(
      "scripts/backfillMatchStatJobs.js"
    );

    if (backfillResult.code !== 0) {
      console.warn(
        `[stats-worker] backfillMatchStatJobs.js exited with code ${backfillResult.code}` +
          (backfillResult.error ? ` (${backfillResult.error})` : "")
      );
      recordSupabaseFailure();
    } else {
      recordSupabaseSuccess();
    }
  }

  const result = await runScript("scripts/processMatchStatJobs.js");

  if (result.code !== 0) {
    console.warn(
      `[stats-worker] processMatchStatJobs.js exited with code ${result.code}` +
        (result.error ? ` (${result.error})` : "")
    );
    recordSupabaseFailure();
    await pingWorkerStatus(
      "error",
      `processMatchStatJobs.js exit=${result.code} ${result.error || ""}`.trim()
    );
    return;
  }

  recordSupabaseSuccess();
  await pingWorkerStatus("online", `cycle=${cycleNumber} ok`);
}

let cycleRunning = false;
let rerunRequested = false;

// Guards against overlap (a Realtime event landing while the fallback timer
// already kicked off a cycle, etc.) and coalesces bursts: if a new trigger
// arrives mid-cycle, it's remembered and runs exactly one more time right
// after, instead of queueing up one run per trigger — claim_match_stat_jobs()
// already claims a whole due batch at once, so there's nothing to gain from
// running once per individual INSERT.
async function scheduleCycle(reason) {
  if (supabaseCircuitBreakerOpen()) {
    return;
  }

  if (cycleRunning) {
    rerunRequested = true;
    return;
  }

  cycleRunning = true;

  try {
    console.log(`[stats-worker] running cycle (${reason})`);
    await runCycleOnce();
  } catch (error) {
    console.error(`[stats-worker] cycle failed (${reason}):`, error);
    recordSupabaseFailure();
    await pingWorkerStatus("error", formatError(error));
  } finally {
    cycleRunning = false;
  }

  if (rerunRequested) {
    rerunRequested = false;
    await scheduleCycle("coalesced");
  }
}

let realtimeChannel = null;

function setupRealtimeSubscription() {
  realtimeChannel = supabase
    .channel("stats-worker-match-stat-jobs")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "match_stat_jobs",
      },
      (payload) => {
        console.log(
          `[stats-worker] Realtime INSERT match_stat_jobs id=${payload.new?.id} ` +
            `job_type=${payload.new?.job_type}`
        );
        scheduleCycle("realtime-insert");
      }
    )
    .subscribe((status) => {
      console.log(`[stats-worker] Realtime channel status: ${status}`);
    });
}

async function main() {
  console.log(
    `[stats-worker] starting — fallback_poll=${FALLBACK_POLL_INTERVAL_MS}ms ` +
      `backfill_every=${BACKFILL_EVERY_N_CYCLES} cycles`
  );

  startSupabaseRequestCounterLog();
  setupRealtimeSubscription();

  // Run once on startup so a backlog that piled up while this process was
  // down (e.g. during a redeploy) gets picked up immediately, instead of
  // waiting for the first fallback tick up to FALLBACK_POLL_INTERVAL_MS later.
  scheduleCycle("startup");

  while (true) {
    if (supabaseCircuitBreakerOpen()) {
      const remainingMs = Math.max(supabaseCircuitOpenUntil - Date.now(), 0);

      console.warn(
        `[stats-worker] circuit breaker open — skipping fallback poll, ` +
          `${Math.round(remainingMs / 1000)}s remaining`
      );

      await sleep(Math.max(remainingMs, 1000));
      continue;
    }

    await sleep(FALLBACK_POLL_INTERVAL_MS);
    await scheduleCycle("fallback-poll");
  }
}

// Railway sends SIGTERM on redeploy/restart — close the Realtime channel
// cleanly instead of leaving the process to be hard-killed mid-connection.
async function shutdown(signal) {
  console.log(`[stats-worker] received ${signal}, closing Realtime channel`);

  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel);
  }

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((error) => {
  console.error("[stats-worker] fatal error:", error);
  process.exit(1);
});
