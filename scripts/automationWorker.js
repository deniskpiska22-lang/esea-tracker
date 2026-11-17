import process from "node:process";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey || !process.env.FACEIT_API_KEY) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY), and FACEIT_API_KEY are required"
  );
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DISCOVERY_INTERVAL_MS = Number(
  process.env.AUTOMATION_DISCOVERY_INTERVAL_MS || 15 * 60 * 1000
);
const STANDINGS_INTERVAL_MS = Number(
  process.env.AUTOMATION_STANDINGS_INTERVAL_MS || 6 * 60 * 60 * 1000
);
const BACKFILL_INTERVAL_MS = Number(
  process.env.AUTOMATION_BACKFILL_INTERVAL_MS || 15 * 60 * 1000
);
const LOOP_INTERVAL_MS = Number(
  process.env.AUTOMATION_LOOP_INTERVAL_MS || 30 * 1000
);
const TASK_TIMEOUT_MS = Number(
  process.env.AUTOMATION_TASK_TIMEOUT_MS || 20 * 60 * 1000
);
const WEEKLY_SNAPSHOT_DAY_UTC = Number(
  process.env.WEEKLY_RATING_SNAPSHOT_DAY_UTC || 1
);

const COACH_INTERVAL_MS = 10 * 60 * 1000;
const once = process.argv.includes("--once");
let stopping = false;
const activeChildren = new Set();
let coachJob = null;
let coachTimer;
let nextCoachAttemptAt = 0;
let lastStandingsAt = 0;
let lastDiscoveryAt = 0;
let lastBackfillAt = 0;
let lastRosterAt = 0;
let lastPlayerEloAt = 0;
let lastWeeklySnapshotKey = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoWeekKey(date = new Date()) {
  const value = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
}

async function heartbeat(status, detail) {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from("worker_status").upsert(
      {
        worker_name: "automation-worker",
        last_ping: now,
        status,
        detail,
        updated_at: now,
      },
      { onConflict: "worker_name" }
    );

    if (error) {
      console.warn(`[automation-worker] heartbeat failed: ${error.message}`);
    }
  } catch (error) {
    console.warn(`[automation-worker] heartbeat failed: ${error.message}`);
  }
}

function runNodeScript(name, scriptPath, args = [], extraEnv = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    console.log(`[automation-worker] ${name} started`);

    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: { ...process.env, ...extraEnv },
    });
    activeChildren.add(child);
    let lastErrorLine = "";
    child.stdout.on("data", chunk => process.stdout.write(chunk));
    child.stderr.on("data", chunk => {
      process.stderr.write(chunk);
      const lines = chunk.toString().trim().split("\n");
      lastErrorLine = lines.at(-1)?.slice(0,300) || lastErrorLine;
    });

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      activeChildren.delete(child);
      resolve({ ...result, durationMs: Date.now() - startedAt });
    };

    const timeout = setTimeout(() => {
      console.error(
        `[automation-worker] ${name} timed out after ${TASK_TIMEOUT_MS}ms`
      );
      child.kill("SIGTERM");
      finish({ code: null, error: "timeout" });
    }, TASK_TIMEOUT_MS);

    child.on("error", (error) => finish({ code: null, error: error.message }));
    child.on("exit", (code, signal) =>
      finish({ code, error: signal ? `signal ${signal}` : code ? lastErrorLine || `exit ${code}` : null })
    );
  });
}

async function runTask(name, scriptPath, args = [], extraEnv = {}) {
  await heartbeat("running", name);
  const result = await runNodeScript(name, scriptPath, args, extraEnv);

  if (result.code !== 0) {
    const detail = `${name} failed: ${result.error || `exit ${result.code}`}`;
    console.error(`[automation-worker] ${detail}`);
    await heartbeat("error", detail);
    return false;
  }

  console.log(
    `[automation-worker] ${name} completed in ${Math.round(result.durationMs / 1000)}s`
  );
  await heartbeat("online", `${name} completed`);
  return true;
}

async function runDueTasks() {
  const now = Date.now();

  // Bounded background profile requests: roster endpoints do not carry CS2 ELO.
  // Run before slower discovery so profile refresh cannot be starved by it.
  if (lastPlayerEloAt === 0 || now - lastPlayerEloAt >= DISCOVERY_INTERVAL_MS) {
    lastPlayerEloAt = now;
    await runTask("player-faceit-elo", "scripts/refreshPlayerFaceitElo.js");
  }

  if (lastStandingsAt === 0 || now - lastStandingsAt >= STANDINGS_INTERVAL_MS) {
    lastStandingsAt = now;
    await runTask("standings-sync", "scripts/v2/syncStandings.js");
  }

  if (lastDiscoveryAt === 0 || now - lastDiscoveryAt >= DISCOVERY_INTERVAL_MS) {
    lastDiscoveryAt = now;
    // Keep imported qualifier brackets and match rows current through the
    // deployed automation service as well as the dedicated tournament worker.
    await runTask("tournament-refresh", "scripts/tournamentWorker.js", ["--once"]);
    await runTask("match-discovery", "scripts/autoSyncMatches.js", [], {
      RUN_POST_MATCH_PIPELINE: "0",
      RUN_WEEKLY_RATING_SNAPSHOT: "0",
    });
  }

  if (lastRosterAt === 0 || now - lastRosterAt >= DISCOVERY_INTERVAL_MS) {
    lastRosterAt = now;
    await runTask("roster-discovery", "scripts/syncTeamRosters.js");
  }

  if (lastBackfillAt === 0 || now - lastBackfillAt >= BACKFILL_INTERVAL_MS) {
    lastBackfillAt = now;
    await runTask("stats-backfill", "scripts/backfillMatchStatJobs.js", [], {
      DEMO_SYNC_ENABLED: "false",
    });
  }

  const date = new Date();
  const weekKey = isoWeekKey(date);
  if (
    date.getUTCDay() === WEEKLY_SNAPSHOT_DAY_UTC &&
    lastWeeklySnapshotKey !== weekKey
  ) {
    const completed = await runTask(
      "weekly-rating-snapshot",
      "scripts/snapshotWeeklyRatingHistory.js"
    );
    if (completed) lastWeeklySnapshotKey = weekKey;
  }

  await heartbeat("online", "idle");
}

// Archive batches must not wait for a full standings or match-discovery run.
function startCoachSync() {
  if (stopping || coachJob || Date.now() < nextCoachAttemptAt) return coachJob;
  coachJob = runNodeScript("coach-season-boundaries", "scripts/syncCoachSeasonBoundaries.js").then(result => {
    if (result.code === 77) {
      nextCoachAttemptAt = Date.now() + 60 * 60 * 1000;
      console.warn("[automation-worker] coach boundary source paused or limited; checkpoint retained");
    } else if (result.code !== 0) {
      console.warn(`[automation-worker] coach-lobbies failed: ${result.error || result.code}`);
    }
  }).finally(() => { coachJob = null; });
  return coachJob;
}

async function main() {
  console.log(
    `[automation-worker] starting: discovery=${DISCOVERY_INTERVAL_MS}ms ` +
      `standings=${STANDINGS_INTERVAL_MS}ms backfill=${BACKFILL_INTERVAL_MS}ms`
  );

  const firstCoachJob = startCoachSync();
  if (!once) coachTimer = setInterval(startCoachSync, COACH_INTERVAL_MS).unref();
  do {
    try {
      await runDueTasks();
    } catch (error) {
      console.error("[automation-worker] cycle failed:", error);
      await heartbeat("error", error.message || String(error));
    }

    if (!once && !stopping) await sleep(LOOP_INTERVAL_MS);
  } while (!once && !stopping);
  await firstCoachJob;
}

function shutdown(signal) {
  console.log(`[automation-worker] received ${signal}`);
  stopping = true;
  clearInterval(coachTimer);
  for (const child of activeChildren) child.kill("SIGTERM");
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((error) => {
  console.error("[automation-worker] fatal error:", error);
  process.exit(1);
});
