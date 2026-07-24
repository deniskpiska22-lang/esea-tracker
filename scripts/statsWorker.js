// ESEA Tracker — постоянный Stats Worker (Railway, отдельный сервис).
//
// Единственная задача: раз в STATS_WORKER_INTERVAL_MS (по умолчанию 45с)
// запускать существующий, немодифицированный scripts/processMatchStatJobs.js
// — claim due match_stat_jobs -> autoSyncMatches.js --post-match-only ->
// done/retry/failed по matches.stats_synced. Никакой собственной логики
// получения/сохранения статистики или парсинга FACEIT здесь нет и не
// должно быть — это уже есть и работает в processMatchStatJobs.js /
// autoSyncMatches.js, этот файл только заводит его в постоянный цикл.
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

const CYCLE_INTERVAL_MS = Number(
  process.env.STATS_WORKER_INTERVAL_MS || 45000
);

// Раз в BACKFILL_EVERY_N_CYCLES циклов также запускаем backfillMatchStatJobs.js
// — дешёвый идемпотентный no-op, если backlog уже заведён в очередь, но
// ловит матчи, которые почему-то не получили job ни от worker.js, ни от
// autoSyncMatches.js (defense in depth, тот же принцип, что и раньше у
// process-stat-jobs.yml, который на каждом тике делал backfill+process).
const BACKFILL_EVERY_N_CYCLES = Number(
  process.env.STATS_WORKER_BACKFILL_EVERY_N_CYCLES || 20
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

async function pingWorkerStatus(status, detail) {
  // Best-effort, как и во всех остальных heartbeat-точках проекта:
  // отсутствие миграции 0008_worker_status.sql не должно останавливать цикл.
  try {
    await supabase.from("worker_status").upsert(
      {
        worker_name: "stats-worker",
        last_ping: new Date().toISOString(),
        status,
        detail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "worker_name" }
    );
  } catch {
    // no-op
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCycle(cycleNumber) {
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
    }
  }

  const result = await runScript("scripts/processMatchStatJobs.js");

  if (result.code !== 0) {
    console.warn(
      `[stats-worker] processMatchStatJobs.js exited with code ${result.code}` +
        (result.error ? ` (${result.error})` : "")
    );
    await pingWorkerStatus(
      "error",
      `processMatchStatJobs.js exit=${result.code} ${result.error || ""}`.trim()
    );
    return;
  }

  await pingWorkerStatus("online", `cycle=${cycleNumber} ok`);
}

async function main() {
  console.log(
    `[stats-worker] starting — interval=${CYCLE_INTERVAL_MS}ms ` +
      `backfill_every=${BACKFILL_EVERY_N_CYCLES} cycles`
  );

  let cycleNumber = 0;

  while (true) {
    cycleNumber += 1;

    try {
      await runCycle(cycleNumber);
    } catch (error) {
      console.error(`[stats-worker] cycle ${cycleNumber} failed:`, error);
      await pingWorkerStatus("error", formatError(error));
    }

    await sleep(CYCLE_INTERVAL_MS);
  }
}

main().catch((error) => {
  console.error("[stats-worker] fatal error:", error);
  process.exit(1);
});
