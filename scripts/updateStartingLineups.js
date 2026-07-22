import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

/*
 * VRS-style roster window:
 * only the five most recent completed matches count.
 */
const RECENT_MATCH_LIMIT = 5;

const STARTING_SIZE = 5;

const FORCE_REBUILD =
  process.argv.includes("--all") ||
  process.argv.includes("--force") ||
  String(process.env.LINEUP_FORCE_REBUILD || "0") === "1";

const FINISHED_STATUSES = [
  "FINISHED",
  "MATCH_STATUS_FINISHED",
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function parseJsonValue(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeId(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || "")
    .replace(/[^a-zа-яё0-9]/gi, "")
    .toLowerCase();
}

function normalizePlayer(rawPlayer, statsTeam = null) {
  if (!rawPlayer) {
    return null;
  }

  const nestedPlayer =
    rawPlayer.player ||
    rawPlayer.player_details ||
    rawPlayer.playerDetails ||
    {};

  const nestedStats =
    rawPlayer.player_stats ||
    rawPlayer.playerStats ||
    rawPlayer.stats ||
    {};

  const faceitId =
    rawPlayer.playerId ||
    rawPlayer.player_id ||
    rawPlayer.faceit_id ||
    rawPlayer.faceitId ||
    rawPlayer.id ||
    nestedPlayer.player_id ||
    nestedPlayer.playerId ||
    nestedPlayer.faceit_id ||
    nestedPlayer.id ||
    null;

  const nickname =
    rawPlayer.nickname ||
    rawPlayer.player_name ||
    rawPlayer.playerName ||
    rawPlayer.name ||
    nestedPlayer.nickname ||
    nestedPlayer.player_name ||
    nestedPlayer.name ||
    nestedStats.Nickname ||
    nestedStats.nickname ||
    null;

  const teamId =
    rawPlayer.teamId ||
    rawPlayer.team_id ||
    statsTeam?.teamId ||
    statsTeam?.team_id ||
    statsTeam?.id ||
    null;

  const teamName =
    rawPlayer.teamName ||
    rawPlayer.team_name ||
    statsTeam?.teamName ||
    statsTeam?.team_name ||
    statsTeam?.name ||
    null;

  if (!faceitId && !nickname) {
    return null;
  }

  const ratingValue =
    rawPlayer.rating ??
    rawPlayer.faceitRating ??
    rawPlayer.faceit_rating ??
    nestedStats.faceitRating ??
    nestedStats.faceit_rating ??
    nestedStats.rating ??
    nestedStats.Rating ??
    null;

  const parsedRating = Number(ratingValue);

  return {
    faceitId: faceitId ? String(faceitId) : null,
    nickname: nickname ? String(nickname) : null,
    teamId: teamId ? String(teamId) : null,
    teamName: teamName ? String(teamName) : null,
    rating:
      Number.isFinite(parsedRating) && parsedRating > 0
        ? parsedRating
        : null,
  };
}

function addPlayerToMap(playersByKey, rawPlayer, statsTeam = null) {
  const player = normalizePlayer(rawPlayer, statsTeam);

  if (!player) {
    return;
  }

  const key =
    normalizeId(player.faceitId) ||
    normalizeName(player.nickname);

  if (!key) {
    return;
  }

  const current = playersByKey.get(key);

  playersByKey.set(key, {
    ...(current || {}),
    ...player,
    nickname:
      player.nickname ||
      current?.nickname ||
      null,
    teamId:
      player.teamId ||
      current?.teamId ||
      null,
    teamName:
      player.teamName ||
      current?.teamName ||
      null,
    rating:
      player.rating ??
      current?.rating ??
      null,
  });
}

function extractPlayers(rawPayload) {
  const payload = parseJsonValue(rawPayload, null);

  if (!payload) {
    return [];
  }

  const playersByKey = new Map();

  const aggregatePlayers = Array.isArray(payload.players)
    ? payload.players
    : [];

  aggregatePlayers.forEach((player) =>
    addPlayerToMap(playersByKey, player)
  );

  const directTeams = Array.isArray(payload.teams)
    ? payload.teams
    : [];

  directTeams.forEach((team) => {
    const players = Array.isArray(team.players)
      ? team.players
      : [];

    players.forEach((player) =>
      addPlayerToMap(playersByKey, player, team)
    );
  });

  const maps = Array.isArray(payload.maps)
    ? payload.maps
    : [];

  maps.forEach((map) => {
    const teams = Array.isArray(map?.teams)
      ? map.teams
      : [];

    teams.forEach((team) => {
      const players = Array.isArray(team.players)
        ? team.players
        : [];

      players.forEach((player) =>
        addPlayerToMap(playersByKey, player, team)
      );
    });
  });

  return [...playersByKey.values()];
}

function resolvePlayerTeam(player, match) {
  const playerTeamId = normalizeId(player.teamId);

  if (playerTeamId) {
    if (playerTeamId === normalizeId(match.team1_id)) {
      return {
        teamId: match.team1_id,
        teamName: match.team1_name,
      };
    }

    if (playerTeamId === normalizeId(match.team2_id)) {
      return {
        teamId: match.team2_id,
        teamName: match.team2_name,
      };
    }
  }

  const playerTeamName = normalizeName(player.teamName);

  if (
    playerTeamName &&
    playerTeamName === normalizeName(match.team1_name)
  ) {
    return {
      teamId: match.team1_id,
      teamName: match.team1_name,
    };
  }

  if (
    playerTeamName &&
    playerTeamName === normalizeName(match.team2_name)
  ) {
    return {
      teamId: match.team2_id,
      teamName: match.team2_name,
    };
  }

  return null;
}

async function loadRecentMatches() {
  const result = [];
  const pageSize = Math.max(
    100,
    Math.min(
      1000,
      Number(
        process.env.LINEUP_MATCH_PAGE_SIZE || 500
      )
    )
  );

  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("matches")
      .select(
        [
          "id",
          "finished_at",
          "scheduled_at",
          "team1_id",
          "team1_name",
          "team2_id",
          "team2_name",
          "player_stats",
        ].join(",")
      )
      .in("status", FINISHED_STATUSES)
      .not("player_stats", "is", null)
      .order("finished_at", {
        ascending: false,
        nullsFirst: false,
      })
      .range(
        from,
        from + pageSize - 1
      );

    if (error) {
      throw new Error(
        `Unable to load match page ${Math.floor(from / pageSize) + 1}: ${error.message}`
      );
    }

    const rows = data || [];
    result.push(...rows);

    console.log(
      `Matches loaded: ${result.length}`
    );

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return result;
}

function buildTeamHistories(matches) {
  const histories = new Map();

  for (const match of matches) {
    const players = extractPlayers(match.player_stats);

    for (const player of players) {
      const team = resolvePlayerTeam(player, match);

      if (!team?.teamId) {
        continue;
      }

      if (!histories.has(team.teamId)) {
        histories.set(team.teamId, []);
      }

      let teamMatch = histories
        .get(team.teamId)
        .find((item) => item.matchId === match.id);

      if (!teamMatch) {
        teamMatch = {
          matchId: match.id,
          playedAt:
            match.finished_at ||
            match.scheduled_at ||
            null,
          teamId: team.teamId,
          teamName: team.teamName,
          players: [],
        };

        histories.get(team.teamId).push(teamMatch);
      }

      const playerKey =
        normalizeId(player.faceitId) ||
        normalizeName(player.nickname);

      if (
        playerKey &&
        !teamMatch.players.some(
          (item) =>
            (normalizeId(item.faceitId) ||
              normalizeName(item.nickname)) === playerKey
        )
      ) {
        teamMatch.players.push(player);
      }
    }
  }

  for (const history of histories.values()) {
    history.sort((first, second) =>
      String(second.playedAt || "").localeCompare(
        String(first.playedAt || "")
      )
    );
  }

  return histories;
}

async function loadPlayersByFaceitIds(faceitIds) {
  const result = new Map();

  /*
   * PostgREST передаёт .in(...) через URL.
   * Большие массивы создают слишком длинный URL
   * и приводят к UND_ERR_HEADERS_OVERFLOW.
   *
   * Поэтому загружаем игроков маленькими пачками.
   */
  const chunkSize = Math.max(
    20,
    Math.min(
      100,
      Number(
        process.env.LINEUP_PLAYER_CHUNK_SIZE || 75
      )
    )
  );

  const uniqueFaceitIds = [
    ...new Set(
      faceitIds
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ];

  for (
    let index = 0;
    index < uniqueFaceitIds.length;
    index += chunkSize
  ) {
    const chunk = uniqueFaceitIds.slice(
      index,
      index + chunkSize
    );

    const { data, error } = await supabase
      .from("players")
      .select(
        "id,faceit_id,nickname,avatar,country,faceit_elo,faceit_level"
      )
      .in("faceit_id", chunk);

    if (error) {
      throw new Error(
        `Unable to load player chunk ${Math.floor(index / chunkSize) + 1}: ${error.message}`
      );
    }

    for (const player of data || []) {
      const key = normalizeId(player.faceit_id);

      if (key) {
        result.set(key, player);
      }
    }

    console.log(
      `Player profiles loaded: ${Math.min(
        index + chunk.length,
        uniqueFaceitIds.length
      )}/${uniqueFaceitIds.length}`
    );
  }

  return result;
}


async function loadSyncStates() {
  const states = new Map();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("team_lineup_sync_state")
      .select(
        "team_id,last_source_match_id,last_source_match_at,updated_at"
      )
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(
        `Unable to load team_lineup_sync_state: ${error.message}`
      );
    }

    const rows = data || [];

    for (const row of rows) {
      states.set(String(row.team_id), row);
    }

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return states;
}

function getNewestHistoryMatch(history) {
  const newest = history?.[0];

  return {
    matchId: newest ? String(newest.matchId || "") : null,
    playedAt: newest?.playedAt || null,
  };
}

function needsLineupUpdate(teamId, history, syncStates) {
  if (FORCE_REBUILD) {
    return true;
  }

  const state = syncStates.get(String(teamId));
  const newest = getNewestHistoryMatch(history);

  if (!state) {
    return true;
  }

  return (
    String(state.last_source_match_id || "") !==
      String(newest.matchId || "") ||
    String(state.last_source_match_at || "") !==
      String(newest.playedAt || "")
  );
}

async function saveSyncState(teamId, history, lineup) {
  const newest = getNewestHistoryMatch(history);

  const { error } = await supabase
    .from("team_lineup_sync_state")
    .upsert(
      {
        team_id: String(teamId),
        last_source_match_id: newest.matchId || null,
        last_source_match_at: newest.playedAt,
        matches_analyzed: lineup.matchesAnalyzed,
        lineup_size: lineup.ranked.length,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "team_id",
      }
    );

  if (error) {
    throw new Error(
      `Unable to save sync state for ${teamId}: ${error.message}`
    );
  }
}

function calculateLineup(history, playersByFaceitId) {
  const recentMatches = history.slice(0, RECENT_MATCH_LIMIT);
  const metrics = new Map();

  recentMatches.forEach((match, index) => {
    const recencyWeight = RECENT_MATCH_LIMIT - index;

    for (const rawPlayer of match.players) {
      const key =
        normalizeId(rawPlayer.faceitId) ||
        normalizeName(rawPlayer.nickname);

      if (!key) {
        continue;
      }

      const current = metrics.get(key) || {
        faceitId: rawPlayer.faceitId,
        nickname: rawPlayer.nickname,
        appearances: 0,
        recentScore: 0,
        playedLastMatch: false,
        lastMatchAt: null,
        ratingSum: 0,
        ratingCount: 0,
      };

      current.appearances += 1;
      current.recentScore += recencyWeight;

      if (index === 0) {
        current.playedLastMatch = true;
      }

      if (!current.lastMatchAt) {
        current.lastMatchAt = match.playedAt;
      }

      const matchRating = Number(rawPlayer.rating);

      if (Number.isFinite(matchRating) && matchRating > 0) {
        current.ratingSum += matchRating;
        current.ratingCount += 1;
      }

      metrics.set(key, current);
    }
  });

  const ranked = [...metrics.values()]
    .map((metric) => {
      const player = playersByFaceitId.get(
        normalizeId(metric.faceitId)
      );

      return {
        ...metric,
        player,
        averageRating:
          metric.ratingCount > 0
            ? metric.ratingSum / metric.ratingCount
            : null,
        score:
          metric.appearances * 10000 +
          metric.recentScore * 100 +
          (metric.playedLastMatch ? 500 : 0) +
          Number(player?.faceit_elo || 0) / 100,
      };
    })
    .filter((item) => item.player?.id)
    .sort(
      (first, second) =>
        second.score - first.score ||
        Number(second.player.faceit_elo || 0) -
          Number(first.player.faceit_elo || 0)
    )
    .slice(0, STARTING_SIZE);

  const matchesAnalyzed = recentMatches.length;
  const minimumAppearances =
    ranked.length > 0
      ? Math.min(...ranked.map((item) => item.appearances))
      : 0;

  let confidence = "provisional";

  if (
    ranked.length === STARTING_SIZE &&
    matchesAnalyzed >= 5 &&
    minimumAppearances >= Math.ceil(matchesAnalyzed * 0.6)
  ) {
    confidence = "confirmed";
  } else if (
    ranked.length === STARTING_SIZE &&
    matchesAnalyzed >= 2
  ) {
    confidence = "probable";
  }

  return {
    ranked,
    matchesAnalyzed,
    confidence,
  };
}

async function saveTeamLineup(teamId, lineup) {
  const { error: deleteError } = await supabase
    .from("team_lineups")
    .delete()
    .eq("team_id", teamId);

  if (deleteError) {
    throw deleteError;
  }

  if (lineup.ranked.length === 0) {
    return;
  }

  const now = new Date().toISOString();

  const rows = lineup.ranked.map((item, index) => ({
    team_id: teamId,
    player_id: item.player.id,
    slot: index + 1,
    appearances: item.appearances,
    matches_analyzed: lineup.matchesAnalyzed,
    recent_score: item.score,
    average_rating:
      item.averageRating !== null
        ? Number(item.averageRating.toFixed(3))
        : null,
    last_match_at: item.lastMatchAt,
    confidence: lineup.confidence,
    source: "match_history",
    updated_at: now,
  }));

  const { error } = await supabase
    .from("team_lineups")
    .insert(rows);

  if (error) {
    throw error;
  }
}

async function main() {
  const matches = await loadRecentMatches();
  const histories = buildTeamHistories(matches);
  const syncStates = await loadSyncStates();

  const changedHistories = new Map();

  for (const [teamId, history] of histories.entries()) {
    if (needsLineupUpdate(teamId, history, syncStates)) {
      changedHistories.set(teamId, history);
    }
  }

  console.log(`Matches with player stats: ${matches.length}`);
  console.log(`Teams discovered: ${histories.size}`);
  console.log(`Teams requiring update: ${changedHistories.size}`);
  console.log(`Force rebuild: ${FORCE_REBUILD ? "yes" : "no"}`);

  if (changedHistories.size === 0) {
    console.log("All team lineups are already up to date.");
    return;
  }

  const faceitIds = new Set();

  for (const history of changedHistories.values()) {
    for (const match of history.slice(0, RECENT_MATCH_LIMIT)) {
      for (const player of match.players) {
        if (player.faceitId) {
          faceitIds.add(player.faceitId);
        }
      }
    }
  }

  const playersByFaceitId = await loadPlayersByFaceitIds(
    [...faceitIds]
  );

  console.log(`Known player profiles: ${playersByFaceitId.size}`);

  let savedTeams = 0;
  let incompleteTeams = 0;
  let failedTeams = 0;

  for (const [teamId, history] of changedHistories.entries()) {
    try {
      const lineup = calculateLineup(history, playersByFaceitId);

      await saveTeamLineup(teamId, lineup);
      await saveSyncState(teamId, history, lineup);

      if (lineup.ranked.length === STARTING_SIZE) {
        savedTeams += 1;
      } else {
        incompleteTeams += 1;
      }

      console.log(
        `${teamId}: ${lineup.ranked.length}/5 players, ` +
          `${lineup.matchesAnalyzed} matches, ${lineup.confidence}`
      );
    } catch (error) {
      failedTeams += 1;
      console.error(
        `${teamId}: FAILED: ${error?.message || error}`
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        teamsDiscovered: histories.size,
        teamsUpdated: changedHistories.size,
        completeLineups: savedTeams,
        incompleteLineups: incompleteTeams,
        failedTeams,
      },
      null,
      2
    )
  );

  if (failedTeams > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exitCode = 1;
});
