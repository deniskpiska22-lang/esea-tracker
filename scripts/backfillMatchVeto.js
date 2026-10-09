import process from "node:process";
import { parseVetoSteps } from "./lib/veto.js";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "(or SUPABASE_SECRET_KEY) are required"
  );
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const BATCH_SIZE = Number(
  process.env.VETO_BACKFILL_BATCH_SIZE || 50
);
const CONCURRENCY = Number(
  process.env.VETO_BACKFILL_CONCURRENCY || 3
);
const FETCH_TIMEOUT_MS = Number(
  process.env.FACEIT_FETCH_TIMEOUT_MS || 20000
);

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

class NotFoundError extends Error {}

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

// Same retry/backoff shape as fetchJson() in autoSyncMatches.js: 5 attempts,
// exponential backoff with jitter on 429/408/5xx/network errors, immediate
// throw on other 4xx. A 404 is treated as "this match has no veto record"
// rather than a transient failure, so it short-circuits straight to
// NotFoundError instead of burning retries.
async function fetchVetoHistory(matchId, attempts = 2) {
  const url = `https://www.faceit.com/api/democracy/v1/match/${encodeURIComponent(
    matchId
  )}/history`;

  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS
    );

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 404) {
        throw new NotFoundError(`404 for match ${matchId}`);
      }

      const httpError = new Error(
        `${response.status} ${response.statusText}`
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
      if (error instanceof NotFoundError) {
        throw error;
      }

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
        `Veto request retry ${attempt}/${attempts} for match ${matchId}: ` +
          formatFetchError(error)
      );
    } finally {
      clearTimeout(timeout);
    }

    const delay =
      Math.min(10000, 750 * 2 ** (attempt - 1)) +
      Math.floor(Math.random() * 500);

    await sleep(delay);
  }

  throw (
    lastError || new Error(`Veto request failed for match ${matchId}`)
  );
}

async function runPool(items, worker, size = CONCURRENCY) {
  let cursor = 0;
  const deadline = Date.now() + Number(process.env.VETO_BACKFILL_MAX_DURATION_MS || 90000);

  const runners = Array.from(
    { length: Math.min(size, Math.max(items.length, 1)) },
    async () => {
      while (cursor < items.length && Date.now() < deadline) {
        const index = cursor;
        cursor += 1;
        await worker(items[index], index);
      }
    }
  );

  await Promise.all(runners);
}

// Faction-relative mirror of parseVetoSteps() in
// src/components/MatchMapResults.jsx — same decider-detection rule (the
// last round is always the decider, regardless of FACEIT's own status/
// selected_by label on it), but keeps "selectedBy" as a raw faction key
// instead of resolving to a team, since one stored row is shared by both
// teams in the match; perspective gets resolved at read time.
// Returns null when the response has no map veto ticket at all (e.g. a
// BO1 the admin set without a public vote) so the caller can tell that
// apart from a fetch failure.
async function markUnavailable(matchId) {
  const { error } = await supabase
    .from("matches")
    .update({
      veto_unavailable: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    throw error;
  }
}

async function processMatch(match, stats) {
  // Small jitter spreads load across the batch, same as
  // syncFinishedMapStats() in autoSyncMatches.js.
  await sleep(Math.floor(150 + Math.random() * 350));

  try {
    const payload = await fetchVetoHistory(match.id);
    const vetoSteps = parseVetoSteps(payload);

    if (!vetoSteps) {
      await markUnavailable(match.id);
      stats.unavailable += 1;
      return;
    }

    const { error } = await supabase
      .from("matches")
      .update({
        veto_steps: vetoSteps,
        veto_synced: true,
        veto_unavailable: false,
        veto_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    if (error) {
      throw error;
    }

    stats.synced += 1;
  } catch (error) {
    if (error instanceof NotFoundError) {
      await markUnavailable(match.id);
      stats.unavailable += 1;
      return;
    }

    // Rate-limit exhaustion, timeouts, and other transient errors are left
    // for the next backfill run (veto_synced/veto_unavailable both stay
    // false) rather than marked unavailable — that flag is reserved for
    // matches confirmed to have no veto data, not ones we just failed to
    // fetch this time.
    stats.failed += 1;
    console.warn(
      `Veto backfill failed for match ${match.id}: ` +
        formatFetchError(error)
    );
  }
}

async function main() {
  // Newest-first: useTeamStats.js only ever loads a team's 3000 most
  // recently finished matches, and recent form is what the Veto tab is
  // actually for — unlike syncFinishedMapStats() (which can afford
  // oldest-first because its 5-15min cron has long since cleared that
  // backlog), this is a one-off backfill against ~9k historical matches,
  // so oldest-first would spend a very long time never reaching matches
  // the frontend can actually show.
  let query = supabase
    .from("matches")
    .select("id")
    .in("status", ["FINISHED", "MATCH_STATUS_FINISHED"])
    .eq("veto_synced", false)
    .eq("veto_unavailable", false)
    .order("finished_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(BATCH_SIZE);

  if (process.env.VETO_BACKFILL_TEAM_ID) {
    const teamId = process.env.VETO_BACKFILL_TEAM_ID;
    if (!/^[a-f0-9-]{36}$/i.test(teamId)) throw new Error("Invalid team ID");
    query = query.or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`);
  }
  if (process.env.VETO_BACKFILL_SINCE) {
    query = query.gte("finished_at", process.env.VETO_BACKFILL_SINCE);
  }
  const { data: matches, error } = await query;

  if (error) {
    throw error;
  }

  const stats = { synced: 0, unavailable: 0, failed: 0 };

  await runPool(matches || [], (match) => processMatch(match, stats));

  console.log(
    `Veto backfill done: ${matches?.length || 0} matches processed — ` +
      `${stats.synced} synced, ${stats.unavailable} unavailable, ` +
      `${stats.failed} failed (left for next run).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
