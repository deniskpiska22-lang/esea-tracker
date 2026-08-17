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

// Те же значения по умолчанию, что и в autoSyncMatches.js — сознательно не
// расходимся, чтобы окно "какие матчи считаются активными" было одинаковым
// для обоих процессов, пока они работают параллельно.
const LIVE_LOOKBACK_HOURS = Number(process.env.LIVE_LOOKBACK_HOURS || 8);
const LIVE_LOOKAHEAD_HOURS = Number(process.env.LIVE_LOOKAHEAD_HOURS || 24);
const REFRESH_CONCURRENCY = Number(process.env.REFRESH_CONCURRENCY || 2);
const FACEIT_FETCH_TIMEOUT_MS = Number(
  process.env.FACEIT_FETCH_TIMEOUT_MS || 20000
);

// --- Supabase call budget: caching, buffering, backoff, circuit breaker ---
// Everything below governs how often/how much this process talks to
// Supabase specifically. It never touches FACEIT polling frequency or
// retry logic (fetchJson() above) — that stays exactly as it was.

// How often the Supabase-backed candidate list itself is refreshed. The
// FACEIT poll tick (TICK_INTERVAL_MS, still 7s) runs against whatever list
// is currently cached in memory — the two are independent now.
const CANDIDATES_REFRESH_MS = Number(
  process.env.LIVE_WORKER_CANDIDATES_REFRESH_MS || 30000
);

// live_worker_log heartbeat rows are buffered in memory and flushed as one
// multi-row insert, instead of one INSERT per 7s tick.
const LOG_FLUSH_INTERVAL_MS = Number(
  process.env.LIVE_WORKER_LOG_FLUSH_INTERVAL_MS || 60000
);
const LOG_FLUSH_MAX_BUFFER = Number(
  process.env.LIVE_WORKER_LOG_MAX_BUFFER || 20
);

// worker_status is only rewritten when the coarse status actually flips
// (online <-> error), or at most this often otherwise — last_ping staleness
// is still a useful liveness signal at 30-60s resolution.
const WORKER_STATUS_MIN_INTERVAL_MS = Number(
  process.env.WORKER_STATUS_MIN_INTERVAL_MS || 30000
);

// Backoff/circuit breaker for Supabase calls only (FACEIT keeps its own
// retry logic in fetchJson()). Base backoff defaults to the normal tick
// interval — the first failure just costs one extra tick's wait, not a
// jump straight to some arbitrary longer number.
const SUPABASE_BASE_BACKOFF_MS = Number(
  process.env.SUPABASE_BASE_BACKOFF_MS || TICK_INTERVAL_MS
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

// Without this, a Supabase call that hangs (DNS not resolving, connection
// never completing — as opposed to a fast rejection like the 402s we
// actually see in production) would block callSupabase() forever: backoff
// and the circuit breaker only react to a promise settling, so a stuck
// promise means neither ever kicks in. Same idea as FACEIT_FETCH_TIMEOUT_MS
// above, applied to the Supabase side.
const SUPABASE_CALL_TIMEOUT_MS = Number(
  process.env.SUPABASE_CALL_TIMEOUT_MS || 15000
);

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

  // Visible on every single failure (not just when the circuit breaker
  // trips) — otherwise the backoff climbing 7s -> 14s -> 28s -> ... is
  // invisible in Railway logs, since most individual Supabase calls
  // (worker_status/live_worker_log) fail silently by design elsewhere.
  console.warn(
    `[worker] Supabase call failed (${supabaseConsecutiveErrors} in a row), ` +
      `next backoff ${supabaseBackoffMs}ms`
  );

  if (supabaseConsecutiveErrors >= SUPABASE_CIRCUIT_BREAKER_THRESHOLD) {
    supabaseCircuitOpenUntil = Date.now() + SUPABASE_CIRCUIT_BREAKER_COOLDOWN_MS;
    console.warn(
      `[worker] Supabase circuit breaker OPEN after ${supabaseConsecutiveErrors} ` +
        `consecutive errors — pausing all Supabase/FACEIT activity for ` +
        `${Math.round(SUPABASE_CIRCUIT_BREAKER_COOLDOWN_MS / 1000)}s`
    );
  }
}

// Every outgoing Supabase call goes through this: counts it (for the
// once-a-minute request log), bounds it to SUPABASE_CALL_TIMEOUT_MS, and
// feeds success/failure into the backoff + circuit breaker above.
// supabase-js query builders resolve to {data, error} instead of throwing,
// so both that shape and a thrown exception (network failure, timeout,
// etc.) count as a failure the same way.
async function callSupabase(fn) {
  supabaseRequestsInWindow += 1;

  // Promise.race() below doesn't cancel the loser — if fn() eventually
  // rejects after the timeout has already won, that rejection needs
  // somewhere to go or Node logs/crashes on an unhandled rejection.
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
      `[worker] ${supabaseRequestsInWindow} requests to Supabase in the last 60s`
    );
    supabaseRequestsInWindow = 0;
  }, 60000).unref();
}

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
  // VOTING (map veto) / CONFIGURING (server setup) sit between READY and
  // ONGOING. Missing here meant loadCandidates()'s status filter dropped a
  // match the instant FACEIT reported VOTING — it fell out of every future
  // poll and never picked up the real round score once play started.
  "VOTING",
  "CONFIGURING",
  // SUBSTITUTION (waiting on a roster sub before the match can proceed) is
  // the same story: missing here meant a match FACEIT parked in
  // SUBSTITUTION dropped out of every future poll and never picked up the
  // eventual FINISHED/auto-win once FACEIT resolved it (e.g. a forfeit for
  // the team that couldn't field a substitute in time).
  "SUBSTITUTION",
  "MATCH_STATUS_READY",
  "MATCH_STATUS_ONGOING",
  "MATCH_STATUS_VOTING",
  "MATCH_STATUS_CONFIGURING",
  "MATCH_STATUS_SUBSTITUTION",
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
  const teams = data?.teams || {};
  // Keyed by the faction key itself (always "faction1"/"faction2" on this
  // endpoint), NOT by Object.entries() iteration order — FACEIT's response
  // has been observed to list faction2 before faction1, and reading
  // entries[0]/entries[1] positionally meant team1/team2 could silently
  // swap identity between polls, flipping which side each team appeared on
  // every time that ordering changed.
  const firstRaw = teams.faction1;
  const secondRaw = teams.faction2;

  if (!firstRaw || !secondRaw) {
    return null;
  }

  const first = normalizeFaction(firstRaw);
  const second = normalizeFaction(secondRaw);

  const firstScore = Number(
    data.results?.score?.faction1 ?? firstRaw?.score ?? 0
  );
  const secondScore = Number(
    data.results?.score?.faction2 ?? secondRaw?.score ?? 0
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
    // team id — must be translated before use.
    winner_id:
      winnerFactionKey === "faction1"
        ? first.id
        : winnerFactionKey === "faction2"
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
    const { data, error } = await callSupabase(() =>
      supabase
        .from("matches")
        .select(COMPARE_FIELDS.concat("id").join(","))
        .eq("id", SINGLE_MATCH_ID)
        .limit(1)
    );

    if (error) {
      throw error;
    }

    return data || [];
  }

  const now = Date.now();
  const from = new Date(now - LIVE_LOOKBACK_HOURS * 3600000).toISOString();
  const to = new Date(now + LIVE_LOOKAHEAD_HOURS * 3600000).toISOString();

  const { data, error } = await callSupabase(() =>
    supabase
      .from("matches")
      .select(COMPARE_FIELDS.concat("id").join(","))
      .in("status", ACTIVE_STATUSES)
      .gte("scheduled_at", from)
      .lte("scheduled_at", to)
      .order("scheduled_at", { ascending: true })
      .limit(300)
  );

  if (error) {
    throw error;
  }

  return data || [];
}

// --- In-memory candidate cache -------------------------------------------
// loadCandidates() above is the only place that reads `matches` from
// Supabase. Without this cache it ran on every 7s FACEIT-poll tick; the set
// of "matches worth watching" changes far less often than that, so the two
// are now decoupled: the candidate list is refreshed at most every
// CANDIDATES_REFRESH_MS, and every tick in between reuses it from memory.
let cachedCandidates = [];
let candidatesLoadedAt = 0;

async function getCandidates() {
  if (SINGLE_MATCH_ID) {
    // Manual/debug single-match mode is low-volume by construction —
    // caching it would just be one more thing to reason about for no
    // meaningful savings, so it always reads fresh.
    return loadCandidates();
  }

  const isStale =
    candidatesLoadedAt === 0 ||
    Date.now() - candidatesLoadedAt >= CANDIDATES_REFRESH_MS;

  if (isStale) {
    cachedCandidates = await loadCandidates();
    candidatesLoadedAt = Date.now();
  }

  return cachedCandidates;
}

// After a match is actually updated in Supabase, patch the cached snapshot
// in place so the next tick's changed() diff compares against the fresh
// values instead of a stale one — otherwise every tick between candidate
// refreshes would see the same "change" again and re-issue the same UPDATE.
function patchCachedCandidate(matchId, patch) {
  const index = cachedCandidates.findIndex(
    (candidate) => candidate.id === matchId
  );

  if (index !== -1) {
    cachedCandidates[index] = { ...cachedCandidates[index], ...patch };
  }
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
    const { error } = await callSupabase(() =>
      supabase.from("match_stat_jobs").upsert(
        {
          match_id: matchId,
          job_type: "stats_sync",
        },
        {
          onConflict: "match_id,job_type",
          ignoreDuplicates: true,
        }
      )
    );

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn(
      `[worker] failed to enqueue stats job for ${matchId}: ${formatFetchError(error)}`
    );
  }

  // demo_sync — paused fleet-wide (2026-07-25): a large demo_sync backlog
  // was starving stats_sync out of every claim_match_stat_jobs() batch,
  // since that RPC claims strictly by created_at with no job_type priority
  // (0003_match_stat_jobs.sql). Re-enable by setting DEMO_SYNC_ENABLED=true
  // once the demo-analysis pipeline is ready to consume the backlog again.
  if (process.env.DEMO_SYNC_ENABLED === "true") {
    try {
      const { error } = await callSupabase(() =>
        supabase.from("match_stat_jobs").upsert(
          {
            match_id: matchId,
            job_type: "demo_sync",
            max_attempts: 20,
          },
          {
            onConflict: "match_id,job_type",
            ignoreDuplicates: true,
          }
        )
      );

      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn(
        `[worker] failed to enqueue demo job for ${matchId}: ${formatFetchError(error)}`
      );
    }
  }
}

// --- live_worker_log: buffered, flushed periodically ---------------------
// Was one INSERT per 7s tick before. Rows are now queued in memory and
// flushed as a single multi-row insert either every LOG_FLUSH_INTERVAL_MS
// or as soon as the buffer hits LOG_FLUSH_MAX_BUFFER, whichever comes
// first — so a burst of activity still flushes promptly instead of sitting
// in memory for up to a minute.
let logBuffer = [];
let lastLogFlushAt = Date.now();

function queueHeartbeat(row) {
  logBuffer.push({ tick_at: new Date().toISOString(), ...row });

  if (logBuffer.length >= LOG_FLUSH_MAX_BUFFER) {
    // Fire-and-forget on purpose: this is a rare safety valve (20 queued
    // rows means the time-based flush below — checked every tick — has
    // somehow not fired in 60s+ of ticking), not the normal path, so it's
    // not worth threading an await through queueHeartbeat() (a sync
    // function called from several places) just for this edge case.
    flushLogBuffer();
  }
}

async function flushLogBuffer() {
  if (logBuffer.length === 0) {
    lastLogFlushAt = Date.now();
    return;
  }

  const rows = logBuffer;
  logBuffer = [];
  lastLogFlushAt = Date.now();

  // Best-effort, same as before the buffer existed: if migration
  // 0002_live_worker_log.sql isn't applied, or the write fails outright,
  // the buffered rows are dropped rather than blocking the tick loop —
  // this is diagnostic data, not something matches/state depends on.
  try {
    await callSupabase(() => supabase.from("live_worker_log").insert(rows));
  } catch {
    // no-op
  }
}

// Awaited (unlike the size-triggered flush above) so its success/failure
// lands in the same sequential chain as every other Supabase call this tick
// made — a background, un-awaited flush racing the main loop's backoff
// sleep would let its failures increment supabaseConsecutiveErrors on their
// own schedule, outside the tick cadence the backoff timing is supposed to
// reflect.
async function flushLogBufferIfDue() {
  if (Date.now() - lastLogFlushAt >= LOG_FLUSH_INTERVAL_MS) {
    await flushLogBuffer();
  }
}

// --- worker_status: only written on a real change -------------------------
// Previously upserted on every single tick regardless of outcome, and the
// `status` column was hardcoded to "online" even on the error path (only
// `detail` said otherwise) — fixed here too, since "write only when status
// changed" needs a real status value to compare against. Still throttled to
// at most once per WORKER_STATUS_MIN_INTERVAL_MS even when nothing changes,
// so last_ping doesn't go stale for longer than that.
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

  try {
    await callSupabase(() =>
      supabase.from("worker_status").upsert(
        {
          worker_name: "live-worker",
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

async function tick() {
  const startedAt = Date.now();

  try {
    let candidates;

    try {
      candidates = await getCandidates();
    } catch (error) {
      console.error(`[worker] failed to load candidates: ${formatFetchError(error)}`);
      queueHeartbeat({
        matches_polled: 0,
        matches_updated: 0,
        error: formatFetchError(error),
      });
      await pingWorkerStatus("error", formatFetchError(error));
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

          const { error } = await callSupabase(() =>
            supabase.from("matches").update(clean).eq("id", match.id)
          );

          if (error) {
            throw error;
          }

          updated += 1;
          patchCachedCandidate(match.id, clean);

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

    queueHeartbeat({
      matches_polled: candidates.length,
      matches_updated: updated,
      error: failed > 0 ? `${failed} match(es) failed to refresh` : null,
    });

    await pingWorkerStatus(
      "online",
      `polled=${candidates.length} updated=${updated} failed=${failed}`
    );
  } finally {
    await flushLogBufferIfDue();
  }
}

async function main() {
  console.log(
    `[worker] starting — interval=${TICK_INTERVAL_MS}ms ` +
    `dry_run=${DRY_RUN} single_match=${SINGLE_MATCH_ID || "none"} ` +
    `candidates_refresh=${CANDIDATES_REFRESH_MS}ms`
  );

  startSupabaseRequestCounterLog();

  while (true) {
    if (supabaseCircuitBreakerOpen()) {
      const remainingMs = Math.max(supabaseCircuitOpenUntil - Date.now(), 0);

      console.warn(
        `[worker] circuit breaker open — skipping tick, ` +
        `${Math.round(remainingMs / 1000)}s remaining`
      );

      await sleep(Math.max(remainingMs, 1000));
      continue;
    }

    await tick();

    if (supabaseCircuitBreakerOpen()) {
      // tick() itself just tripped the breaker — let the top-of-loop check
      // above own the wait next time around (it sleeps exactly the
      // remaining cooldown) instead of ALSO sleeping the accumulated
      // backoff on top of it, which can legitimately be longer than the
      // cooldown itself (backoff caps at SUPABASE_MAX_BACKOFF_MS
      // independently of SUPABASE_CIRCUIT_BREAKER_COOLDOWN_MS).
      continue;
    }

    await sleep(
      supabaseConsecutiveErrors > 0 ? supabaseBackoffMs : TICK_INTERVAL_MS
    );
  }
}

// Railway sends SIGTERM on redeploy/restart — flush whatever's still
// buffered in memory instead of silently dropping it, now that
// live_worker_log writes are no longer immediate.
async function shutdown(signal) {
  console.log(`[worker] received ${signal}, flushing log buffer before exit`);
  await flushLogBuffer();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((error) => {
  console.error("[worker] fatal error:", error);
  process.exit(1);
});
