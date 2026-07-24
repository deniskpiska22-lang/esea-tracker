// ESEA Tracker — live match worker (Этап 3, MVP).
//
// Единственная задача: тикать по матчам в SCHEDULED/READY/ONGOING каждые
// несколько секунд и обновлять status/score/started_at/finished_at/winner_id
// через официальный FACEIT Data API v4 (open.faceit.com/data/v4/matches/{id}).
//
// НЕ трогает: stats_synced, статистику карт/игроков, рейтинги, ростеры,
// discovery новых матчей — это всё остаётся зоной ответственности
// autoSyncMatches.js (не изменён) и .github/workflows/{sync-matches,sync-live}.yml
// (не изменены, продолжают работать как раньше).
//
// Логика тика (fetchJson/publicApiToPatch/normalizeFaction/asIso/changed/
// COMPARE_FIELDS/runPool/запрос кандидатов) дословно перенесена из
// scripts/autoSyncMatches.js (refreshActive + вспомогательные функции), а не
// написана заново — чтобы новый процесс гарантированно вёл себя так же, как
// уже работающий в проде refreshActive, только чаще.
//
// Запуск: node --env-file=.env.local scripts/worker.js
// Флаги/переменные окружения:
//   LIVE_WORKER_INTERVAL_MS   — интервал тика, мс (по умолчанию 7000)
//   LIVE_WORKER_DRY_RUN=1     — считать и логировать патчи, ничего не писать в Supabase
//   --match-id=<id>           — ограничить тик одним матчем (для локальных тестов)
//   LIVE_LOOKBACK_HOURS/LIVE_LOOKAHEAD_HOURS/REFRESH_CONCURRENCY/
//   FACEIT_FETCH_TIMEOUT_MS   — те же переменные и значения по умолчанию,
//                               что уже использует autoSyncMatches.js

import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import teams from "../src/data/teams.generated.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;
const faceitApiKey = process.env.FACEIT_API_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are required"
  );
}

if (!faceitApiKey) {
  throw new Error("FACEIT_API_KEY is required");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DRY_RUN =
  process.env.LIVE_WORKER_DRY_RUN === "1" ||
  process.argv.includes("--dry-run");

const SINGLE_MATCH_ID = (() => {
  const arg = process.argv.find((a) => a.startsWith("--match-id="));
  return arg ? arg.split("=")[1] : null;
})();

const TICK_INTERVAL_MS = Number(
  process.env.LIVE_WORKER_INTERVAL_MS || 7000
);

// GitHub Actions' process-stat-jobs.yml (*/3 * * * *) is best-effort and in
// practice can drift by 1-2+ hours under GitHub's own scheduler load — not
// something fixable from this repo. worker.js already runs continuously on
// Railway, so it doubles as a much more reliable clock for draining
// match_stat_jobs. This does NOT replace process-stat-jobs.yml (still a
// useful second producer/consumer if Railway is ever down) — just adds a
// second, steadier cadence. Set to 0 to disable.
const STAT_JOBS_TICK_INTERVAL_MS = Number(
  process.env.STAT_JOBS_TICK_INTERVAL_MS || 180000
);

// Те же значения по умолчанию, что и в autoSyncMatches.js — сознательно не
// расходимся, чтобы окно "какие матчи считаются активными" было одинаковым
// для обоих процессов, пока они работают параллельно.
const LIVE_LOOKBACK_HOURS = Number(process.env.LIVE_LOOKBACK_HOURS || 8);
const LIVE_LOOKAHEAD_HOURS = Number(process.env.LIVE_LOOKAHEAD_HOURS || 24);
const REFRESH_CONCURRENCY = Number(process.env.REFRESH_CONCURRENCY || 2);
const FACEIT_FETCH_TIMEOUT_MS = Number(
  process.env.FACEIT_FETCH_TIMEOUT_MS || 20000
);

const FINISHED_STATUSES = new Set([
  "FINISHED",
  "MATCH_STATUS_FINISHED",
  "CANCELLED",
  "MATCH_STATUS_CANCELLED",
]);

const LIVE_STATUSES = [
  "READY",
  "ONGOING",
  "LIVE",
  "MATCH_STATUS_READY",
  "MATCH_STATUS_ONGOING",
];

const ACTIVE_STATUSES = ["SCHEDULED", "MATCH_STATUS_SCHEDULED", ...LIVE_STATUSES];

const COMPARE_FIELDS = [
  "championship_id",
  "competition_name",
  "status",
  "best_of",
  "scheduled_at",
  "started_at",
  "finished_at",
  "team1_id",
  "team1_name",
  "team1_slug",
  "team1_logo",
  "team1_score",
  "team2_id",
  "team2_name",
  "team2_slug",
  "team2_logo",
  "team2_score",
  "winner_id",
  "faceit_url",
];

const normalizeName = (value = "") => value.replace(/\s+/g, "").toLowerCase();

function localTeam(id, name) {
  return (
    teams.find((team) => team.faceitTeamId === id) ||
    teams.find(
      (team) => name && normalizeName(team.name) === normalizeName(name)
    ) ||
    null
  );
}

function asIso(value) {
  if (!value) {
    return null;
  }

  const date =
    typeof value === "number" ? new Date(value * 1000) : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeFaction(faction = {}) {
  const id =
    faction.premade_team_id ||
    faction.faction_id ||
    faction.team_id ||
    faction.id ||
    null;

  const name = faction.name || faction.nickname || "TBD";
  const local = localTeam(id, name);

  return {
    id,
    name: local?.name || name,
    slug: local?.slug || null,
    logo: local?.logo || faction.avatar || faction.logo || null,
  };
}

function publicApiToPatch(data) {
  const entries = Object.entries(data?.teams || {});

  if (entries.length < 2) {
    return null;
  }

  const [firstKey, firstRaw] = entries[0];
  const [secondKey, secondRaw] = entries[1];

  const first = normalizeFaction(firstRaw);
  const second = normalizeFaction(secondRaw);

  const firstScore = Number(
    data.results?.score?.[firstKey] ?? firstRaw?.score ?? 0
  );
  const secondScore = Number(
    data.results?.score?.[secondKey] ?? secondRaw?.score ?? 0
  );

  const status = data.status || "UNKNOWN";
  const finished = FINISHED_STATUSES.has(status.toUpperCase());
  const winnerFactionKey = data.results?.winner;

  return {
    status,
    best_of: data.best_of ?? null,
    competition_name:
      data.competition_name || data.competition?.name || undefined,
    scheduled_at: asIso(data.scheduled_at),
    started_at: asIso(data.started_at),
    finished_at:
      asIso(data.finished_at) ||
      (finished ? new Date().toISOString() : undefined),
    team1_id: first.id,
    team1_name: first.name,
    team1_slug: first.slug,
    team1_logo: first.logo,
    team1_score: firstScore,
    team2_id: second.id,
    team2_name: second.name,
    team2_slug: second.slug,
    team2_logo: second.logo,
    team2_score: secondScore,
    // data.results.winner is a faction key ("faction1"/"faction2"), not a
    // team id — must be translated via firstKey/secondKey before use.
    winner_id:
      winnerFactionKey === firstKey
        ? first.id
        : winnerFactionKey === secondKey
          ? second.id
          : finished
            ? firstScore > secondScore
              ? first.id
              : secondScore > firstScore
                ? second.id
                : null
            : null,
    raw_data: data,
  };
}

// Supabase returns timestamptz as "...+00:00" while asIso() produces
// "...Z" (via Date#toISOString()) — same instant, different string. Without
// normalizing, changed() would treat every timestamp field as "changed" on
// every comparison, even when nothing actually changed.
function normalizeCompareValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(String(value))) {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString();
    }
  }

  return String(value);
}

function changed(existing, incoming) {
  if (!existing) {
    return true;
  }

  // publicApiToPatch() never sets championship_id/faceit_url (Data API v4
  // doesn't carry them) — only compare fields the incoming patch actually
  // touches, not every COMPARE_FIELDS entry unconditionally.
  return COMPARE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(incoming, field)
  ).some((field) => {
    const before = normalizeCompareValue(existing[field] ?? null);
    const after = normalizeCompareValue(incoming[field] ?? null);
    return before !== after;
  });
}

function formatFetchError(error) {
  const parts = [
    error?.name,
    error?.message,
    error?.cause?.code,
    error?.cause?.errno,
    error?.cause?.syscall,
    error?.cause?.hostname,
  ].filter(Boolean);

  return parts.join(" | ") || "Unknown fetch error";
}

function isRetryableFetchError(error) {
  const code = error?.cause?.code || error?.code || "";

  return (
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    error?.message === "fetch failed" ||
    [
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "EAI_AGAIN",
      "ENOTFOUND",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_SOCKET",
    ].includes(code)
  );
}

async function fetchJson(url, options = {}, attempts = 5) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      FACEIT_FETCH_TIMEOUT_MS
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (response.ok) {
        return await response.json();
      }

      const body = (await response.text()).slice(0, 500);
      const details = body ? `: ${body}` : "";
      const httpError = new Error(
        `${response.status} ${response.statusText}${details}`
      );
      httpError.status = response.status;

      if (
        response.status < 500 &&
        response.status !== 408 &&
        response.status !== 429
      ) {
        throw httpError;
      }

      lastError = httpError;
    } catch (error) {
      lastError = error;

      const retryable =
        isRetryableFetchError(error) ||
        error?.status === 408 ||
        error?.status === 429 ||
        Number(error?.status) >= 500;

      if (!retryable || attempt === attempts) {
        throw error;
      }

      console.warn(
        `FACEIT request retry ${attempt}/${attempts} ${url}: ${formatFetchError(error)}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function runPool(items, worker, size) {
  let cursor = 0;

  const runners = Array.from(
    { length: Math.min(size, Math.max(items.length, 1)) },
    async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        await worker(item);
      }
    }
  );

  await Promise.all(runners);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadCandidates() {
  if (SINGLE_MATCH_ID) {
    const { data, error } = await supabase
      .from("matches")
      .select(COMPARE_FIELDS.concat("id").join(","))
      .eq("id", SINGLE_MATCH_ID)
      .limit(1);

    if (error) {
      throw error;
    }

    return data || [];
  }

  const now = Date.now();
  const from = new Date(now - LIVE_LOOKBACK_HOURS * 3600000).toISOString();
  const to = new Date(now + LIVE_LOOKAHEAD_HOURS * 3600000).toISOString();

  const { data, error } = await supabase
    .from("matches")
    .select(COMPARE_FIELDS.concat("id").join(","))
    .in("status", ACTIVE_STATUSES)
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .order("scheduled_at", { ascending: true })
    .limit(300);

  if (error) {
    throw error;
  }

  return data || [];
}

// Matches worth fetching stats for — narrower than FINISHED_STATUSES, which
// also includes CANCELLED (relevant for finished_at/winner_id elsewhere,
// not for stats: a cancelled match has no map/player stats to sync).
const STATS_ELIGIBLE_STATUSES = new Set([
  "FINISHED",
  "MATCH_STATUS_FINISHED",
]);

// Producer #1 (see also autoSyncMatches.js refreshActive() — same hook,
// kept as a fallback in case this process is down when a match finishes).
// Best-effort: match_stat_jobs is an optional acceleration layer, not the
// only path to stats — the existing stats_synced=false scan in
// autoSyncMatches.js remains the safety net regardless of this insert's
// outcome, so a failure here must never break the tick.
async function createStatJobIfFinished(matchId, status) {
  if (!STATS_ELIGIBLE_STATUSES.has(String(status).toUpperCase())) {
    return;
  }

  try {
    const { error } = await supabase.from("match_stat_jobs").upsert(
      {
        match_id: matchId,
        job_type: "stats_sync",
      },
      {
        onConflict: "match_id,job_type",
        ignoreDuplicates: true,
      }
    );

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn(
      `[worker] failed to enqueue stats job for ${matchId}: ${formatFetchError(error)}`
    );
  }
}

// Fire-and-forget: runs scripts/processMatchStatJobs.js — the existing,
// unmodified consumer (claim -> autoSyncMatches.js --post-match-only ->
// resolve done/retry/failed) — on its own cadence, decoupled from the 7s
// live tick so a multi-minute stat-jobs pass never delays live score
// updates. claim_match_stat_jobs() already uses FOR UPDATE SKIP LOCKED, so
// this is safe to overlap with a concurrent GitHub Actions run; the guard
// below just avoids piling up redundant local runs if one is still going.
let statJobsRunning = false;

function runStatJobsCycle() {
  if (statJobsRunning) {
    return;
  }

  statJobsRunning = true;
  const child = spawn(
    process.execPath,
    ["scripts/processMatchStatJobs.js"],
    { stdio: "inherit", shell: false, env: process.env }
  );

  const finish = () => {
    statJobsRunning = false;
  };

  child.on("error", (error) => {
    console.warn(`[worker] stat-jobs cycle failed to start: ${formatFetchError(error)}`);
    finish();
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.warn(`[worker] stat-jobs cycle exited with code ${code}`);
    }
    finish();
  });
}

async function logHeartbeat(row) {
  // Best-effort: если миграция 0002_live_worker_log.sql ещё не применена к
  // этой базе, просто молча пропускаем — воркер не должен падать из-за
  // отсутствия необязательной таблицы наблюдаемости.
  try {
    await supabase.from("live_worker_log").insert(row);
  } catch {
    // no-op
  }
}

async function tick() {
  const startedAt = Date.now();
  let candidates;

  try {
    candidates = await loadCandidates();
  } catch (error) {
    console.error(`[worker] failed to load candidates: ${formatFetchError(error)}`);
    await logHeartbeat({
      matches_polled: 0,
      matches_updated: 0,
      error: formatFetchError(error),
    });
    return;
  }

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  await runPool(
    candidates,
    async (match) => {
      try {
        await sleep(50 + Math.floor(Math.random() * 150));

        const payload = await fetchJson(
          `https://open.faceit.com/data/v4/matches/${encodeURIComponent(match.id)}`,
          {
            headers: {
              Authorization: `Bearer ${faceitApiKey}`,
              Accept: "application/json",
            },
          }
        );

        const patch = publicApiToPatch(payload);
        if (!patch) {
          return;
        }

        const clean = Object.fromEntries(
          Object.entries(patch).filter(([, value]) => value !== undefined)
        );

        if (!changed(match, clean)) {
          unchanged += 1;
          return;
        }

        if (DRY_RUN) {
          console.log(`[dry-run] would update ${match.id}:`, clean);
          updated += 1;
          return;
        }

        clean.updated_at = new Date().toISOString();

        const { error } = await supabase
          .from("matches")
          .update(clean)
          .eq("id", match.id);

        if (error) {
          throw error;
        }

        updated += 1;
        console.log(
          `[worker] ${match.id}: ${match.status} -> ${clean.status} ` +
          `(${clean.team1_score ?? match.team1_score}:${clean.team2_score ?? match.team2_score})`
        );

        await createStatJobIfFinished(match.id, clean.status);
      } catch (error) {
        failed += 1;
        console.warn(`[worker] refresh failed ${match.id}: ${formatFetchError(error)}`);
      }
    },
    REFRESH_CONCURRENCY
  );

  const durationMs = Date.now() - startedAt;

  console.log(
    `[worker] tick: polled=${candidates.length} updated=${updated} ` +
    `unchanged=${unchanged} failed=${failed} duration=${durationMs}ms` +
    (DRY_RUN ? " (dry-run)" : "")
  );

  await logHeartbeat({
    matches_polled: candidates.length,
    matches_updated: updated,
    error: failed > 0 ? `${failed} match(es) failed to refresh` : null,
  });
}

async function main() {
  console.log(
    `[worker] starting — interval=${TICK_INTERVAL_MS}ms ` +
    `dry_run=${DRY_RUN} single_match=${SINGLE_MATCH_ID || "none"} ` +
    `stat_jobs_interval=${STAT_JOBS_TICK_INTERVAL_MS}ms`
  );

  let lastStatJobsRunAt = 0;

  while (true) {
    await tick();

    if (
      STAT_JOBS_TICK_INTERVAL_MS > 0 &&
      !DRY_RUN &&
      !SINGLE_MATCH_ID &&
      Date.now() - lastStatJobsRunAt >= STAT_JOBS_TICK_INTERVAL_MS
    ) {
      lastStatJobsRunAt = Date.now();
      runStatJobsCycle();
    }

    await sleep(TICK_INTERVAL_MS);
  }
}

main().catch((error) => {
  console.error("[worker] fatal error:", error);
  process.exit(1);
});
