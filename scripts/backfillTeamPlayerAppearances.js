import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are required",
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE_SIZE = 250;
const INSERT_BATCH_SIZE = 250;

function clean(value) {
  const result = String(value ?? "").trim();
  return result || null;
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getTeams(playerStats) {
  if (!playerStats) return [];
  if (Array.isArray(playerStats)) return playerStats;
  if (Array.isArray(playerStats.teams)) return playerStats.teams;
  if (Array.isArray(playerStats.items)) return playerStats.items;
  return [];
}

function getPlayers(statsTeam) {
  if (Array.isArray(statsTeam?.players)) return statsTeam.players;
  if (Array.isArray(statsTeam?.player_stats)) return statsTeam.player_stats;
  if (Array.isArray(statsTeam?.playerStats)) return statsTeam.playerStats;
  return [];
}

function getPlayerFaceitId(player) {
  return clean(
    player?.playerId ||
      player?.player_id ||
      player?.faceit_id ||
      player?.id,
  );
}

function getPlayerNickname(player) {
  return clean(
    player?.nickname ||
      player?.playerName ||
      player?.player_name ||
      player?.name,
  ) || "Unknown";
}

function getStatsTeamId(statsTeam) {
  return clean(
    statsTeam?.teamId ||
      statsTeam?.team_id ||
      statsTeam?.id,
  );
}

function getStatsTeamName(statsTeam) {
  return clean(
    statsTeam?.teamName ||
      statsTeam?.team_name ||
      statsTeam?.name,
  );
}

function resolveTeamId(statsTeam, match) {
  const statsId = getStatsTeamId(statsTeam);
  const statsName = normalizeName(getStatsTeamName(statsTeam));

  if (statsId && statsId === clean(match.team1_id)) return clean(match.team1_id);
  if (statsId && statsId === clean(match.team2_id)) return clean(match.team2_id);

  if (statsName && statsName === normalizeName(match.team1_name)) {
    return clean(match.team1_id) || statsId;
  }
  if (statsName && statsName === normalizeName(match.team2_name)) {
    return clean(match.team2_id) || statsId;
  }

  return statsId;
}

async function fetchMatchesPage(from) {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id,team1_id,team1_name,team2_id,team2_name,finished_at,scheduled_at,player_stats,status",
    )
    .in("status", ["FINISHED", "MATCH_STATUS_FINISHED"])
    .not("player_stats", "is", null)
    .order("finished_at", { ascending: true, nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    throw new Error(`Failed to load matches: ${error.message}`);
  }

  return data || [];
}

async function loadExistingAppearances(matchIds) {
  const keys = new Set();

  for (let index = 0; index < matchIds.length; index += 100) {
    const batch = matchIds.slice(index, index + 100);
    const { data, error } = await supabase
      .from("team_player_appearances")
      .select("match_id,team_id,player_id")
      .in("match_id", batch);

    if (error) {
      throw new Error(`Failed to load existing appearances: ${error.message}`);
    }

    for (const row of data || []) {
      keys.add(`${row.match_id}|${row.team_id}|${row.player_id}`);
    }
  }

  return keys;
}

async function upsertPlayers(playersByFaceitId) {
  const entries = [...playersByFaceitId.entries()];
  const databaseIds = new Map();

  for (let index = 0; index < entries.length; index += INSERT_BATCH_SIZE) {
    const batch = entries.slice(index, index + INSERT_BATCH_SIZE);
    const now = new Date().toISOString();
    const rows = batch.map(([faceitId, nickname]) => ({
      faceit_id: faceitId,
      nickname,
      updated_at: now,
    }));

    const { data, error } = await supabase
      .from("players")
      .upsert(rows, { onConflict: "faceit_id" })
      .select("id,faceit_id");

    if (error) {
      throw new Error(`Player upsert failed: ${error.message}`);
    }

    for (const row of data || []) {
      databaseIds.set(row.faceit_id, row.id);
    }
  }

  return databaseIds;
}

async function ensureRelations(rows) {
  const uniqueRows = [];
  const seen = new Set();

  for (const row of rows) {
    const key = `${row.team_id}|${row.player_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  for (let index = 0; index < uniqueRows.length; index += 100) {
    const batch = uniqueRows.slice(index, index + 100);

    for (const row of batch) {
      const { data: existing, error: lookupError } = await supabase
        .from("team_players")
        .select("id")
        .eq("team_id", row.team_id)
        .eq("player_id", row.player_id)
        .limit(1);

      if (lookupError) {
        throw new Error(`Relation lookup failed: ${lookupError.message}`);
      }

      if ((existing || []).length > 0) continue;

      const { error: insertError } = await supabase
        .from("team_players")
        .insert({
          team_id: row.team_id,
          player_id: row.player_id,
          joined_at: row.played_at,
          left_at: null,
          is_active: false,
        });

      if (insertError) {
        throw new Error(`Relation insert failed: ${insertError.message}`);
      }
    }
  }
}

async function insertAppearances(rows) {
  let inserted = 0;

  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + INSERT_BATCH_SIZE);
    const { error } = await supabase
      .from("team_player_appearances")
      .insert(batch);

    if (error) {
      throw new Error(`Appearance insert failed: ${error.message}`);
    }

    inserted += batch.length;
  }

  return inserted;
}

async function processPage(matches) {
  const parsed = [];
  const playersByFaceitId = new Map();
  let skippedTeams = 0;
  let skippedPlayers = 0;

  for (const match of matches) {
    const playedAt =
      match.finished_at || match.scheduled_at || new Date().toISOString();

    for (const statsTeam of getTeams(match.player_stats)) {
      const teamId = resolveTeamId(statsTeam, match);
      if (!teamId) {
        skippedTeams += 1;
        continue;
      }

      for (const player of getPlayers(statsTeam)) {
        const faceitId = getPlayerFaceitId(player);
        if (!faceitId) {
          skippedPlayers += 1;
          continue;
        }

        playersByFaceitId.set(faceitId, getPlayerNickname(player));
        parsed.push({
          match_id: match.id,
          team_id: teamId,
          faceit_id: faceitId,
          played_at: playedAt,
        });
      }
    }
  }

  if (parsed.length === 0) {
    return { inserted: 0, parsed: 0, skippedTeams, skippedPlayers };
  }

  const playerIds = await upsertPlayers(playersByFaceitId);
  const existing = await loadExistingAppearances(
    unique(parsed.map((row) => row.match_id)),
  );

  const candidates = [];
  const relations = [];

  for (const row of parsed) {
    const playerId = playerIds.get(row.faceit_id);
    if (!playerId) continue;

    const key = `${row.match_id}|${row.team_id}|${playerId}`;
    if (existing.has(key)) continue;
    existing.add(key);

    const appearance = {
      match_id: row.match_id,
      team_id: row.team_id,
      player_id: playerId,
      played_at: row.played_at,
    };

    candidates.push(appearance);
    relations.push(appearance);
  }

  await ensureRelations(relations);
  const inserted = await insertAppearances(candidates);

  return {
    inserted,
    parsed: parsed.length,
    skippedTeams,
    skippedPlayers,
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function main() {
  console.log("Backfilling team player appearances from matches.player_stats...");

  let from = 0;
  let matchesProcessed = 0;
  let appearancesParsed = 0;
  let appearancesInserted = 0;
  let skippedTeams = 0;
  let skippedPlayers = 0;

  while (true) {
    const matches = await fetchMatchesPage(from);
    if (matches.length === 0) break;

    const result = await processPage(matches);

    matchesProcessed += matches.length;
    appearancesParsed += result.parsed;
    appearancesInserted += result.inserted;
    skippedTeams += result.skippedTeams;
    skippedPlayers += result.skippedPlayers;

    console.log(
      `Matches ${matchesProcessed}; parsed ${appearancesParsed}; inserted ${appearancesInserted}`,
    );

    if (matches.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        matchesProcessed,
        appearancesParsed,
        appearancesInserted,
        skippedTeams,
        skippedPlayers,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
