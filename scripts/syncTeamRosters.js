import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import teams from "../src/data/teams.generated.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

const FACEIT_BATCH_URL =
  "https://www.faceit.com/api/teams/v3/teams/batch-get";

const FACEIT_SESSION_COOKIE =
  process.env.FACEIT_SESSION_COOKIE ||
  process.env.FACEIT_STATS_COOKIE ||
  "";

const BATCH_SIZE = Math.max(
  1,
  Math.min(100, Number(process.env.ROSTER_BATCH_SIZE || 50)),
);

const REQUEST_DELAY_MS = Math.max(
  0,
  Number(process.env.ROSTER_SYNC_DELAY_MS || 500),
);

const REQUEST_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.ROSTER_REQUEST_TIMEOUT_MS || 30000),
);

const MAX_ATTEMPTS = Math.max(
  1,
  Number(process.env.ROSTER_REQUEST_ATTEMPTS || 4),
);

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is required");
}

if (!SUPABASE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is required",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanString(value) {
  const result = String(value ?? "").trim();
  return result || null;
}

function normalizeCountry(value) {
  const country = cleanString(value);
  return country ? country.toUpperCase() : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function splitIntoChunks(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function normalizeMember(raw) {
  const faceitId = cleanString(raw?.id ?? raw?.player_id ?? raw?.playerId);

  if (!faceitId) {
    return null;
  }

  const cs2 = raw?.games?.cs2 || {};

  return {
    faceit_id: faceitId,
    nickname: cleanString(raw?.nickname ?? raw?.name) || faceitId,
    avatar: cleanString(raw?.avatar),
    country: normalizeCountry(raw?.country),
    steam_id: cleanString(
      raw?.steam_id_64 ?? raw?.steam_id ?? raw?.steamId,
    ),
    faceit_elo: numberOrNull(
      cs2?.faceit_elo ?? cs2?.faceitElo ?? raw?.faceit_elo ?? raw?.elo,
    ),
    faceit_level:
      numberOrNull(
        cs2?.skill_level ??
          cs2?.skillLevel ??
          raw?.skill_level ??
          raw?.level,
      ) ?? 1,
    updated_at: new Date().toISOString(),
  };
}

async function fetchBatch(ids) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers = {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json",
        origin: "https://www.faceit.com",
        referer: "https://www.faceit.com/",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/142.0.0.0 Safari/537.36",
      };

      if (FACEIT_SESSION_COOKIE) {
        headers.cookie = FACEIT_SESSION_COOKIE;
      }

      const response = await fetch(FACEIT_BATCH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ ids }),
        signal: controller.signal,
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(
          `${response.status} ${response.statusText}: ${text.slice(0, 500)}`,
        );
      }

      const json = text ? JSON.parse(text) : {};
      const payload = Array.isArray(json?.payload) ? json.payload : [];

      return payload;
    } catch (error) {
      lastError = error;

      if (attempt < MAX_ATTEMPTS) {
        const waitMs = 1000 * attempt;
        console.warn(
          `FACEIT batch attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}. Retry in ${waitMs} ms`,
        );
        await sleep(waitMs);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("FACEIT batch request failed");
}

async function upsertPlayers(members) {
  const uniqueRows = Array.from(
    new Map(
      members
        .map(normalizeMember)
        .filter(Boolean)
        .map((player) => [player.faceit_id, player]),
    ).values(),
  );

  if (!uniqueRows.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("players")
    .upsert(uniqueRows, { onConflict: "faceit_id" })
    .select("id,faceit_id,nickname");

  if (error) {
    throw new Error(`players upsert failed: ${error.message}`);
  }

  return data || [];
}

async function syncOneTeam(faceitTeam) {
  const teamId = cleanString(faceitTeam?.id);

  if (!teamId) {
    return { skipped: true, reason: "missing_team_id" };
  }

  const members = Array.isArray(faceitTeam?.members)
    ? faceitTeam.members
    : [];

  const databasePlayers = await upsertPlayers(members);
  const activePlayerIds = databasePlayers.map((player) => player.id);
  const now = new Date().toISOString();

  const { data: existingLinks, error: linksReadError } = await supabase
    .from("team_players")
    .select("id,player_id,joined_at,is_active")
    .eq("team_id", teamId);

  if (linksReadError) {
    throw new Error(
      `team_players read failed for ${teamId}: ${linksReadError.message}`,
    );
  }

  const existingByPlayerId = new Map(
    (existingLinks || []).map((link) => [link.player_id, link]),
  );

  if (databasePlayers.length) {
    const relationRows = databasePlayers.map((player) => {
      const existing = existingByPlayerId.get(player.id);

      return {
        team_id: teamId,
        player_id: player.id,
        joined_at: existing?.joined_at || now,
        left_at: null,
        is_active: true,
      };
    });

    const { error: relationError } = await supabase
      .from("team_players")
      .upsert(relationRows, { onConflict: "team_id,player_id" });

    if (relationError) {
      throw new Error(
        `team_players upsert failed for ${teamId}: ${relationError.message}`,
      );
    }
  }

  const staleLinkIds = (existingLinks || [])
    .filter(
      (link) =>
        link.is_active === true && !activePlayerIds.includes(link.player_id),
    )
    .map((link) => link.id);

  if (staleLinkIds.length) {
    const { error: deactivateError } = await supabase
      .from("team_players")
      .update({
        is_active: false,
        left_at: now,
      })
      .in("id", staleLinkIds);

    if (deactivateError) {
      throw new Error(
        `Could not deactivate old players for ${teamId}: ${deactivateError.message}`,
      );
    }
  }

  return {
    skipped: false,
    members: databasePlayers.length,
    deactivated: staleLinkIds.length,
  };
}

async function main() {
  const startedAt = Date.now();

  const localTeams = Array.from(
    new Map(
      teams
        .filter((team) => cleanString(team?.faceitTeamId))
        .map((team) => [team.faceitTeamId, team]),
    ).values(),
  );

  const ids = localTeams.map((team) => team.faceitTeamId);
  const chunks = splitIntoChunks(ids, BATCH_SIZE);

  console.log(`Local teams with faceitTeamId: ${ids.length}`);
  console.log(`Batch size: ${BATCH_SIZE}; requests planned: ${chunks.length}`);

  let receivedTeams = 0;
  let syncedTeams = 0;
  let failedTeams = 0;
  let missingTeams = 0;
  let playersSynced = 0;
  let playersDeactivated = 0;

  for (let batchIndex = 0; batchIndex < chunks.length; batchIndex += 1) {
    const batchIds = chunks[batchIndex];

    try {
      const payload = await fetchBatch(batchIds);
      const returnedIds = new Set(payload.map((team) => cleanString(team?.id)));

      receivedTeams += payload.length;
      missingTeams += batchIds.filter((id) => !returnedIds.has(id)).length;

      for (const faceitTeam of payload) {
        try {
          const result = await syncOneTeam(faceitTeam);

          if (!result.skipped) {
            syncedTeams += 1;
            playersSynced += result.members;
            playersDeactivated += result.deactivated;
          }
        } catch (error) {
          failedTeams += 1;
          console.warn(
            `TEAM FAIL ${faceitTeam?.id || "unknown"}: ${error.message}`,
          );
        }
      }

      console.log(
        `[${batchIndex + 1}/${chunks.length}] ` +
          `requested=${batchIds.length}, returned=${payload.length}, ` +
          `teamsSynced=${syncedTeams}, players=${playersSynced}`,
      );
    } catch (error) {
      failedTeams += batchIds.length;
      console.error(
        `[${batchIndex + 1}/${chunks.length}] BATCH FAIL: ${error.message}`,
      );
    }

    if (REQUEST_DELAY_MS && batchIndex < chunks.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const summary = {
    ok: failedTeams === 0,
    localTeams: ids.length,
    batches: chunks.length,
    receivedTeams,
    syncedTeams,
    missingTeams,
    failedTeams,
    playersSynced,
    playersDeactivated,
    durationMs: Date.now() - startedAt,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failedTeams > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Roster sync failed:", error);
  process.exitCode = 1;
});
