import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import teams from "../src/data/teams.generated.js";
import { CHAMPIONSHIPS } from "./matchSyncConfig.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

const faceitApiKey = process.env.FACEIT_API_KEY;

const faceitSessionCookie =
  process.env.FACEIT_SESSION_COOKIE ||
  process.env.FACEIT_STATS_COOKIE ||
  "";

const mode = process.argv.includes("--live")
  ? "live"
  : "full";

// Used by scripts/processMatchStatJobs.js: skip discovery/refresh entirely
// and only run the existing RUN_POST_MATCH_PIPELINE block below — narrows
// FACEIT API usage to what that block already does on its own
// (syncFinishedMapStats() only scans matches.stats_synced=false).
const postMatchOnly = process.argv.includes(
  "--post-match-only"
);

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "(or SUPABASE_SECRET_KEY) are required"
  );
}

if (!faceitApiKey) {
  throw new Error("FACEIT_API_KEY is required");
}

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const championshipName = new Map(
  CHAMPIONSHIPS.map((item) => [
    item.id,
    item.name,
  ])
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
  // Same statuses worker.js's LIVE_STATUSES tracks (see the comment there):
  // VOTING/CONFIGURING sit between READY and ONGOING, and SUBSTITUTION can
  // block a match before it even reaches voting. This GH Actions sweep is
  // the backup path when worker.js is down, so it needs to recognize the
  // exact same active statuses — otherwise a match parked in one of these
  // while worker.js happens to be unavailable falls out of both refresh
  // loops and never advances again.
  "VOTING",
  "CONFIGURING",
  "SUBSTITUTION",
  "MATCH_STATUS_READY",
  "MATCH_STATUS_ONGOING",
  "MATCH_STATUS_VOTING",
  "MATCH_STATUS_CONFIGURING",
  "MATCH_STATUS_SUBSTITUTION",
];

const ACTIVE_STATUSES = [
  "SCHEDULED",
  "MATCH_STATUS_SCHEDULED",
  ...LIVE_STATUSES,
];

const DISCOVERY_DAYS_AHEAD = Number(
  process.env.DISCOVERY_DAYS_AHEAD || 7
);

const FINISHED_DAYS_BACK = Number(
  process.env.FINISHED_DAYS_BACK || 7
);

const LIVE_LOOKBACK_HOURS = Number(
  process.env.LIVE_LOOKBACK_HOURS || 8
);

const LIVE_LOOKAHEAD_HOURS = Number(
  process.env.LIVE_LOOKAHEAD_HOURS || 24
);

const concurrency = Number(
  process.env.MATCH_SYNC_CONCURRENCY || 3
);

const REFRESH_CONCURRENCY = Number(
  process.env.REFRESH_CONCURRENCY || 2
);

const FACEIT_FETCH_TIMEOUT_MS = Number(
  process.env.FACEIT_FETCH_TIMEOUT_MS || 20000
);

const MAP_STATS_BATCH_SIZE = Number(
  process.env.MAP_STATS_BATCH_SIZE || 50
);

const LINEUP_SYNC_BATCH_SIZE = Number(
  process.env.LINEUP_SYNC_BATCH_SIZE || 100
);

const LINEUP_SYNC_DAYS_BACK = Number(
  process.env.LINEUP_SYNC_DAYS_BACK || 30
);

const RUN_POST_MATCH_PIPELINE =
  String(
    process.env.RUN_POST_MATCH_PIPELINE || "1"
  ) === "1";

const RUN_PLAYER_SYNC =
  String(
    process.env.RUN_PLAYER_SYNC || "1"
  ) === "1";

const RUN_LINEUP_SYNC =
  String(
    process.env.RUN_LINEUP_SYNC || "1"
  ) === "1";

const RUN_RATINGS_AFTER_SYNC =
  String(
    process.env.RUN_RATINGS_AFTER_SYNC || "1"
  ) === "1";

const STARTING_LINEUP_SCRIPT =
  process.env.STARTING_LINEUP_SCRIPT ||
  "./scripts/updateStartingLineups.js";

const AUTOMATIC_RATING_SCRIPT =
  process.env.AUTOMATIC_RATING_SCRIPT ||
  "./scripts/recalculateRatingsAfterMatch.js";

// snapshotRatingChanges.js writes weekly_points_change/weekly_rank_change
// (the "week" toggle on the rankings page) — previously only ever run
// manually via recalculateAndSnapshotRatings.js, so it silently went stale
// as soon as ratings started updating through the automatic pipeline
// without it. Runs right after AUTOMATIC_RATING_SCRIPT so both "since last
// update" and "this week" deltas stay in sync on every post-match cycle.
const RATING_DELTA_SNAPSHOT_SCRIPT =
  process.env.RATING_DELTA_SNAPSHOT_SCRIPT ||
  "./scripts/snapshotRatingChanges.js";

const RUN_WEEKLY_RATING_SNAPSHOT =
  String(
    process.env.RUN_WEEKLY_RATING_SNAPSHOT || "1"
  ) === "1";

const WEEKLY_RATING_SNAPSHOT_DAY_UTC =
  Number(
    process.env.WEEKLY_RATING_SNAPSHOT_DAY_UTC || 0
  );

const WEEKLY_RATING_SNAPSHOT_SCRIPT =
  process.env.WEEKLY_RATING_SNAPSHOT_SCRIPT ||
  "./scripts/snapshotWeeklyRatingHistory.js";


const RUN_PLAYER_RATINGS_AFTER_SYNC =
  String(
    process.env.RUN_PLAYER_RATINGS_AFTER_SYNC || "1"
  ) === "1";

const PLAYER_RATING_SCRIPT =
  process.env.PLAYER_RATING_SCRIPT ||
  "./scripts/recalculatePlayerRatings.js";

function isValidPlayerNickname(value) {
  const nickname = String(value || "").trim();

  return (
    Boolean(nickname) &&
    nickname.toLowerCase() !== "unknown"
  );
}

async function upsertRosterPlayer(player) {
  const faceitId =
    player?.playerId ||
    player?.player_id ||
    player?.faceit_id ||
    player?.faceitId ||
    player?.id ||
    null;

  if (!faceitId) {
    return null;
  }

  const incomingNickname =
    String(
      player?.nickname ||
      player?.playerName ||
      player?.player_name ||
      ""
    ).trim();

  const {
    data: existingPlayer,
    error: lookupError,
  } = await supabase
    .from("players")
    .select("id,faceit_id,nickname")
    .eq("faceit_id", faceitId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Player lookup failed ${faceitId}: ${lookupError.message}`
    );
  }

  /*
   * Если FACEIT не прислал ник, не создаём новую
   * запись с "Unknown" и не затираем существующий ник.
   */
  if (!isValidPlayerNickname(incomingNickname)) {
    if (existingPlayer) {
      return existingPlayer;
    }

    console.warn(
      `Player skipped without nickname: ${faceitId}`
    );

    return null;
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("players")
    .upsert(
      {
        faceit_id: faceitId,
        nickname: incomingNickname,
        updated_at: now,
      },
      {
        onConflict: "faceit_id",
      }
    )
    .select("id,faceit_id,nickname")
    .single();

  if (error) {
    throw new Error(
      `Player upsert failed ${faceitId}: ${error.message}`
    );
  }

  return data;
}

async function ensureTeamPlayerRelation(
  teamId,
  databasePlayerId
) {
  if (!teamId || !databasePlayerId) {
    return;
  }

  const {
    data: existingRelation,
    error: relationLookupError,
  } = await supabase
    .from("team_players")
    .select(
      "id,team_id,player_id,is_active,joined_at,left_at"
    )
    .eq("team_id", teamId)
    .eq("player_id", databasePlayerId)
    .maybeSingle();

  if (relationLookupError) {
    throw new Error(
      `Team player lookup failed ` +
        `${teamId}/${databasePlayerId}: ` +
        relationLookupError.message
    );
  }

  if (existingRelation) {
    return existingRelation;
  }

  const {
    data: insertedRelation,
    error: relationInsertError,
  } = await supabase
    .from("team_players")
    .insert({
      team_id: teamId,
      player_id: databasePlayerId,
      joined_at: new Date().toISOString(),
      left_at: null,
      is_active: false,
    })
    .select(
      "id,team_id,player_id,is_active,joined_at,left_at"
    )
    .single();

  if (relationInsertError) {
    throw new Error(
      `Team player insert failed ` +
        `${teamId}/${databasePlayerId}: ` +
        relationInsertError.message
    );
  }

  return insertedRelation;
}

async function savePlayerAppearance({
  matchId,
  teamId,
  databasePlayerId,
  playedAt,
}) {
  if (!matchId || !teamId || !databasePlayerId) {
    return false;
  }

  const { data: existing, error: lookupError } = await supabase
    .from("team_player_appearances")
    .select("id")
    .eq("match_id", matchId)
    .eq("team_id", teamId)
    .eq("player_id", databasePlayerId)
    .limit(1);

  if (lookupError) {
    throw new Error(
      `Player appearance lookup failed ` +
        `${matchId}/${teamId}/${databasePlayerId}: ` +
        lookupError.message
    );
  }

  if (Array.isArray(existing) && existing.length > 0) {
    return false;
  }

  const { error: insertError } = await supabase
    .from("team_player_appearances")
    .insert({
      match_id: matchId,
      team_id: teamId,
      player_id: databasePlayerId,
      played_at: playedAt || new Date().toISOString(),
    });

  if (insertError) {
    throw new Error(
      `Player appearance insert failed ` +
        `${matchId}/${teamId}/${databasePlayerId}: ` +
        insertError.message
    );
  }

  return true;
}

function resolveStatsTeamId(
  statsTeam,
  matchContext
) {
  const statsTeamId =
    statsTeam?.teamId ||
    statsTeam?.team_id ||
    null;

  const statsTeamName =
    statsTeam?.teamName ||
    statsTeam?.team_name ||
    "";

  if (
    statsTeamId &&
    statsTeamId ===
      matchContext.team1Id
  ) {
    return matchContext.team1Id;
  }

  if (
    statsTeamId &&
    statsTeamId ===
      matchContext.team2Id
  ) {
    return matchContext.team2Id;
  }

  if (
    statsTeamName &&
    matchContext.team1Name &&
    normalizeName(statsTeamName) ===
      normalizeName(
        matchContext.team1Name
      )
  ) {
    return matchContext.team1Id;
  }

  if (
    statsTeamName &&
    matchContext.team2Name &&
    normalizeName(statsTeamName) ===
      normalizeName(
        matchContext.team2Name
      )
  ) {
    return matchContext.team2Id;
  }

  if (statsTeamId) {
    return statsTeamId;
  }

  return null;
}

async function updateTeamRosterFromPlayerStats({
  matchId,
  playerStats,
  playedAt,
  team1Id,
  team1Name,
  team2Id,
  team2Name,
}) {
  const statsTeams = Array.isArray(
    playerStats?.teams
  )
    ? playerStats.teams
    : [];

  if (
    !matchId ||
    !statsTeams.length
  ) {
    return {
      teams: 0,
      players: 0,
      appearances: 0,
    };
  }

  const matchContext = {
    team1Id,
    team1Name,
    team2Id,
    team2Name,
  };

  const touchedTeams = new Set();

  let playerCount = 0;
  let appearanceCount = 0;

  for (const statsTeam of statsTeams) {
    const resolvedTeamId =
      resolveStatsTeamId(
        statsTeam,
        matchContext
      );

    if (!resolvedTeamId) {
      console.warn(
        `Roster team unresolved ${matchId}: ` +
          `${statsTeam?.teamName || "Unknown"}`
      );

      continue;
    }

    const statsPlayers =
      Array.isArray(
        statsTeam?.players
      )
        ? statsTeam.players
        : [];

    if (!statsPlayers.length) {
      continue;
    }

    for (const player of statsPlayers) {
      const databasePlayer =
        await upsertRosterPlayer(
          player
        );

      if (!databasePlayer?.id) {
        continue;
      }

      await ensureTeamPlayerRelation(
        resolvedTeamId,
        databasePlayer.id
      );

      const insertedAppearance = await savePlayerAppearance({
        matchId,
        teamId: resolvedTeamId,
        databasePlayerId: databasePlayer.id,
        playedAt,
      });

      playerCount += 1;
      if (insertedAppearance) {
        appearanceCount += 1;
      }
    }

    touchedTeams.add(
      resolvedTeamId
    );
  }

  console.log(
    `Roster stats synced ${matchId}: ` +
      `${touchedTeams.size} team(s), ` +
      `${playerCount} player(s), ` +
      `${appearanceCount} appearance(s)`
  );

  return {
    teams: touchedTeams.size,
    players: playerCount,
    appearances: appearanceCount,
  };
}

function cleanMapName(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  return raw
    .replace(/^de_/i, "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(
      (part) =>
        part[0].toUpperCase() +
        part.slice(1).toLowerCase()
    )
    .join("");
}

function statValue(
  stats,
  keys,
  fallback = 0
) {
  for (const key of keys) {
    const value = stats?.[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      const number = Number(value);

      return Number.isNaN(number)
        ? fallback
        : number;
    }
  }

  return fallback;
}

function normalizePlayer(player = {}) {
  const stats =
    player.player_stats ||
    player.playerStats ||
    player.stats ||
    player;

  const kills = statValue(stats, [
    "Kills",
    "kills",
  ]);

  const deaths = statValue(stats, [
    "Deaths",
    "deaths",
  ]);

  const headshots = statValue(stats, [
    "Headshots",
    "headshots",
  ]);

  const rawHsRate = statValue(
    stats,
    [
      "Headshots %",
      "Headshots%",
      "HS%",
      "hsRate",
      "headshots_percentage",
    ],
    null
  );

  const rawKd = statValue(
    stats,
    [
      "K/D Ratio",
      "K/D",
      "kd",
    ],
    null
  );

  return {
    playerId:
      player.player_id ||
      player.playerId ||
      player.id ||
      null,

    nickname:
      player.nickname ||
      player.player_name ||
      player.playerName ||
      stats.Nickname ||
      null,

    kills,

    deaths,

    assists: statValue(stats, [
      "Assists",
      "assists",
    ]),

    adr: statValue(stats, [
      "ADR",
      "adr",
      "Average Damage per Round",
    ]),

    kd:
      rawKd !== null
        ? rawKd
        : deaths > 0
          ? kills / deaths
          : kills,

    hsRate:
      rawHsRate !== null
        ? rawHsRate
        : kills > 0
          ? (headshots / kills) * 100
          : 0,

    // No default fallback: unlike kd/hsRate, KAST has no reliable
    // local formula to derive from other fields — if the source doesn't
    // report it (official Data API v4 never does), leave it null rather
    // than silently claiming a 0% KAST that wasn't actually measured.
    kast: statValue(
      stats,
      ["KAST %", "KAST", "kast"],
      null
    ),

    mvps: statValue(stats, [
      "MVPs",
      "MVP",
      "mvps",
    ]),
  };
}

function normalizeStatsTeam(team = {}) {
  const teamStats =
    team.team_stats ||
    team.teamStats ||
    team.stats ||
    team;

  const players = Array.isArray(
    team.players
  )
    ? team.players
    : [];

  return {
    teamId:
      team.team_id ||
      team.teamId ||
      teamStats.TeamId ||
      teamStats.team_id ||
      null,

    teamName:
      team.team_name ||
      team.teamName ||
      teamStats.Team ||
      teamStats.team_name ||
      "Unknown",

    score: statValue(teamStats, [
      "Final Score",
      "Score",
      "score",
      "final_score",
    ]),

    players: players.map(
      normalizePlayer
    ),
  };
}


function normalizeScoreboardSummaryPlayer(player = {}) {
  return normalizePlayer({
    ...player,
    nickname:
      player.nickname ||
      player.playerName ||
      player.player_name ||
      null,
  });
}

function mergeScoreboardPlayer(target, player) {
  const stats = player?.stats || {};
  const rounds = Number(stats.roundsPlayed || 0);
  const damage = Number(stats.damage || 0);
  const kills = Number(stats.kills || 0);
  const deaths = Number(stats.deaths || 0);
  const assists = Number(stats.assists || 0);
  const hsKills = Number(stats.hsKills || 0);
  const kast = Number(stats.kast || 0);
  const rating = Number(stats.faceitRating || 0);

  target.playerId =
    target.playerId ||
    player.playerId ||
    player.player_id ||
    player.id ||
    null;

  target.nickname =
    target.nickname ||
    player.nickname ||
    player.playerName ||
    player.player_name ||
    null;

  target.elo = Math.max(
    Number(target.elo || 0),
    Number(player.elo || 0)
  );

  target._rounds += rounds;
  target._damage += damage;
  target._kills += kills;
  target._deaths += deaths;
  target._assists += assists;
  target._hsKills += hsKills;
  target._mvps += Number(stats.mvps || 0);
  target._kastWeighted += kast * rounds;
  target._ratingWeighted += rating * rounds;
}

function normalizeScoreboardSummaries(
  payloads,
  matchId
) {
  const teams = new Map();

  for (const payload of payloads) {
    const cs2 = payload?.payload?.cs2;
    const payloadTeams = Array.isArray(cs2?.teams)
      ? cs2.teams
      : [];

    for (const team of payloadTeams) {
      const teamId = team?.teamId || null;

      if (!teamId) {
        continue;
      }

      if (!teams.has(teamId)) {
        teams.set(teamId, {
          teamId,
          teamName: team?.teamName || "Unknown",
          score: 0,
          players: new Map(),
        });
      }

      const targetTeam = teams.get(teamId);
      targetTeam.score += Number(team?.score || 0);

      for (const player of Array.isArray(team?.players)
        ? team.players
        : []) {
        const playerId =
          player?.playerId ||
          player?.player_id ||
          player?.id ||
          null;

        if (!playerId) {
          continue;
        }

        if (!targetTeam.players.has(playerId)) {
          targetTeam.players.set(playerId, {
            playerId,
            nickname: null,
            elo: 0,
            _rounds: 0,
            _damage: 0,
            _kills: 0,
            _deaths: 0,
            _assists: 0,
            _hsKills: 0,
            _mvps: 0,
            _kastWeighted: 0,
            _ratingWeighted: 0,
          });
        }

        mergeScoreboardPlayer(
          targetTeam.players.get(playerId),
          player
        );
      }
    }
  }

  const normalizedTeams = Array.from(teams.values()).map(
    (team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      score: team.score,
      players: Array.from(team.players.values()).map(
        (player) => {
          const rounds = player._rounds;
          const kills = player._kills;
          const deaths = player._deaths;

          return normalizeScoreboardSummaryPlayer({
            playerId: player.playerId,
            nickname: player.nickname,
            elo: player.elo,
            stats: {
              roundsPlayed: rounds,
              kills,
              deaths,
              assists: player._assists,
              damage: player._damage,
              adr:
                rounds > 0
                  ? player._damage / rounds
                  : 0,
              kd:
                deaths > 0
                  ? kills / deaths
                  : kills,
              hsKills: player._hsKills,
              hsRate:
                kills > 0
                  ? player._hsKills / kills
                  : 0,
              kast:
                rounds > 0
                  ? player._kastWeighted / rounds
                  : 0,
              mvps: player._mvps,
              faceitRating:
                rounds > 0
                  ? player._ratingWeighted / rounds
                  : 0,
            },
          });
        }
      ),
    })
  );

  if (!normalizedTeams.length) {
    return null;
  }

  return {
    matchId,
    map: null,
    teams: normalizedTeams,
  };
}

async function fetchScoreboardSummaries(
  matchId,
  expectedRoundCount = 0
) {
  const payloads = [];
  const maxRounds = expectedRoundCount > 0
    ? Math.min(expectedRoundCount, 5)
    : 5;

  for (let round = 1; round <= maxRounds; round += 1) {
    const url =
      `https://www.faceit.com/api/statistics/v1/cs2/matches/${encodeURIComponent(
        matchId
      )}/match-rounds/${round}/scoreboard-summary?statsType=2`;

    try {
      const payload = await fetchJson(url, {
        headers: {
          Accept: "application/json, text/plain, */*",
          ...(faceitSessionCookie
            ? { Cookie: faceitSessionCookie }
            : {}),
          Referer:
            `https://www.faceit.com/en/cs2/room/${encodeURIComponent(
              matchId
            )}`,
          "User-Agent":
            process.env.FACEIT_USER_AGENT ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",
          "Accept-Language":
            "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
          "Faceit-Referer": "web-next",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      const teams = payload?.payload?.cs2?.teams;

      if (!Array.isArray(teams) || !teams.length) {
        break;
      }

      payloads.push(payload);
    } catch (error) {
      if (round === 1) {
        throw error;
      }

      break;
    }
  }

  return payloads;
}

// Shared by the internal stats/v3 payload (entry.matchRound) and the
// official data/v4/.../stats payload (entry.match_round) — both sometimes
// carry a whole-match summary entry (round index 0) alongside per-map
// entries; prefer that summary, else fall back to the first entry that
// actually has player data. Not new aggregation logic — this is the exact
// selection this file already used for the internal payload, only reused
// instead of duplicated so the official-API path behaves identically.
function findMatchSummaryEntry(entries) {
  return (
    entries.find((entry) => {
      const roundIndex = Number(
        entry?.matchRound ??
        entry?.match_round
      );

      if (roundIndex !== 0) {
        return false;
      }

      if (
        !Array.isArray(entry?.teams)
      ) {
        return false;
      }

      return entry.teams.some(
        (team) =>
          Array.isArray(team?.players) &&
          team.players.length > 0
      );
    }) ||
    entries.find((entry) => {
      if (
        !Array.isArray(entry?.teams)
      ) {
        return false;
      }

      return entry.teams.some(
        (team) =>
          Array.isArray(team?.players) &&
          team.players.length > 0
      );
    }) ||
    null
  );
}

function normalizeInternalPlayerStats(
  payload,
  matchId
) {
  const entries = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.rounds)
        ? payload.rounds
        : [];

  const summary =
    findMatchSummaryEntry(entries);

  if (!summary) {
    return null;
  }

  return {
    matchId,

    map:
      summary.map ||
      summary.mapName ||
      null,

    teams: summary.teams
      .slice(0, 2)
      .map(normalizeStatsTeam),
  };
}

function normalizeInternalMatchStats(
  payload
) {
  const entries = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.rounds)
        ? payload.rounds
        : [];

  let mapEntries = entries.filter(
    (entry) =>
      Number(entry?.matchRound) > 0
  );

  if (!mapEntries.length) {
    mapEntries = entries.filter(
      (entry) => {
        const teamsRaw = Array.isArray(
          entry?.teams
        )
          ? entry.teams
          : [];

        if (
          !entry?.map ||
          teamsRaw.length < 2
        ) {
          return false;
        }

        const scores = teamsRaw
          .slice(0, 2)
          .map(
            (team) =>
              Number(team?.score || 0)
          );

        return (
          Math.max(...scores) >
          Number(entry?.bestOf || 1)
        );
      }
    );
  }

  return mapEntries
    .map((entry, index) => {
      const teamsNormalized = (
        Array.isArray(entry?.teams)
          ? entry.teams
          : []
      )
        .slice(0, 2)
        .map((team) => ({
          teamId:
            team?.teamId ||
            team?.team_id ||
            null,

          teamName:
            team?.teamName ||
            team?.team_name ||
            null,

          score: Number(
            team?.score || 0
          ),
        }));

      const map = cleanMapName(
        entry?.map ||
        entry?.mapName
      );

      if (
        !map ||
        teamsNormalized.length < 2
      ) {
        return null;
      }

      return {
        map,

        order: Number(
          entry?.matchRound ||
          index + 1
        ),

        teams: teamsNormalized,
      };
    })
    .filter(Boolean)
    .sort(
      (first, second) =>
        first.order - second.order
    );
}

function normalizeOfficialMatchStats(
  payload,
  matchId
) {
  const rounds = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rounds)
      ? payload.rounds
      : [];

  // Whole-match player stats (kills/deaths/assists/ADR/KD/HS/MVP —
  // everything normalizeStatsTeam()/normalizePlayer() already know how to
  // read, since data/v4's team_stats/player_stats keys match what those
  // functions were already written for). Reuses the same summary-entry
  // selection as the internal stats/v3 path — no new aggregation.
  const summaryEntry =
    findMatchSummaryEntry(rounds);

  const playerStats = summaryEntry
    ? {
        matchId,
        map: null,
        teams: summaryEntry.teams
          .slice(0, 2)
          .map(normalizeStatsTeam),
      }
    : null;

  // All maps are kept below — a BO3 has one entry per map here, never
  // truncated to the first.
  const mapRounds = rounds
    .map((round, index) => {
      const roundStats =
        round?.round_stats ||
        round?.roundStats ||
        round ||
        {};

      const teamsRaw = Array.isArray(
        round?.teams
      )
        ? round.teams
        : [];

      const teamsNormalized =
        teamsRaw.map((team) => {
          const teamStats =
            team?.team_stats ||
            team?.teamStats ||
            team ||
            {};

          return {
            teamId:
              team?.team_id ||
              team?.teamId ||
              teamStats?.TeamId ||
              teamStats?.team_id ||
              null,

            teamName:
              team?.team_name ||
              team?.teamName ||
              teamStats?.Team ||
              teamStats?.team_name ||
              null,

            score: statValue(
              teamStats,
              [
                "Final Score",
                "Score",
                "score",
                "final_score",
              ]
            ),
          };
        });

      const map = cleanMapName(
        roundStats?.Map ||
        roundStats?.map ||
        roundStats?.MapName ||
        round?.map
      );

      if (
        !map ||
        teamsNormalized.length < 2
      ) {
        return null;
      }

      return {
        map,

        order: Number(
          roundStats?.Round ||
          roundStats?.round ||
          index + 1
        ),

        teams:
          teamsNormalized.slice(0, 2),
      };
    })
    .filter(Boolean);

  return {
    rounds: mapRounds,
    playerStats,
  };
}

function mapsForMatch(
  mapRounds,
  match
) {
  return mapRounds.map((round) => {
    const first =
      round.teams.find(
        (team) =>
          team.teamId === match.team1_id
      ) ||
      round.teams[0];

    const second =
      round.teams.find(
        (team) =>
          team.teamId === match.team2_id
      ) ||
      round.teams.find(
        (team) => team !== first
      ) ||
      round.teams[1];

    const team1Score = Number(
      first?.score || 0
    );

    const team2Score = Number(
      second?.score || 0
    );

    return {
      map: round.map,

      order: round.order,

      team1_id:
        first?.teamId ||
        match.team1_id,

      team1_name:
        first?.teamName ||
        match.team1_name,

      team1_score: team1Score,

      team2_id:
        second?.teamId ||
        match.team2_id,

      team2_name:
        second?.teamName ||
        match.team2_name,

      team2_score: team2Score,

      winner_id:
        team1Score > team2Score
          ? first?.teamId ||
            match.team1_id
          : team2Score > team1Score
            ? second?.teamId ||
              match.team2_id
            : null,
    };
  });
}

const sleep = (milliseconds) =>
  new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );

const normalizeName = (
  value = ""
) =>
  value
    .replace(/\s+/g, "")
    .toLowerCase();

function asIso(value) {
  if (!value) {
    return null;
  }

  const date =
    typeof value === "number"
      ? new Date(value * 1000)
      : new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date.toISOString();
}

function localTeam(id, name) {
  return (
    teams.find(
      (team) =>
        team.faceitTeamId === id
    ) ||
    teams.find(
      (team) =>
        name &&
        normalizeName(team.name) ===
          normalizeName(name)
    ) ||
    null
  );
}

function normalizeFaction(
  faction = {}
) {
  const id =
    faction.premade_team_id ||
    faction.faction_id ||
    faction.team_id ||
    faction.id ||
    null;

  const name =
    faction.name ||
    faction.nickname ||
    "TBD";

  const local = localTeam(
    id,
    name
  );

  return {
    id,

    name:
      local?.name ||
      name,

    slug:
      local?.slug ||
      null,

    logo:
      local?.logo ||
      faction.avatar ||
      faction.logo ||
      null,
  };
}

function scoreFromInternal(
  match,
  faction,
  index
) {
  return (
    faction?.match_score ??
    match?.results?.score?.[
      faction?.premade_team_id
    ] ??
    match?.results?.score?.[
      faction?.id
    ] ??
    match?.[
      `team${index + 1}_score`
    ] ??
    0
  );
}

function internalToRow(match) {
  const factions = Array.isArray(
    match.factions
  )
    ? match.factions
    : [
        match.team1,
        match.team2,
      ].filter(Boolean);

  if (
    !match?.id ||
    factions.length < 2
  ) {
    return null;
  }

  const first = normalizeFaction(
    factions[0]
  );

  const second = normalizeFaction(
    factions[1]
  );

  const firstScore = Number(
    scoreFromInternal(
      match,
      factions[0],
      0
    ) || 0
  );

  const secondScore = Number(
    scoreFromInternal(
      match,
      factions[1],
      1
    ) || 0
  );

  const status =
    match.status ||
    "MATCH_STATUS_SCHEDULED";

  const finished =
    FINISHED_STATUSES.has(
      status.toUpperCase()
    );

  return {
    id: match.id,

    championship_id:
      match.championship_id ||
      null,

    competition_name:
      championshipName.get(
        match.championship_id
      ) ||
      match.championship_name ||
      "ESEA League",

    status,

    best_of:
      match.best_of ??
      null,

    scheduled_at: asIso(
      match.scheduled_time ||
      match.scheduled_at
    ),

    started_at: asIso(
      match.started_time ||
      match.started_at
    ),

    finished_at: asIso(
      match.finished_time ||
      match.finished_at
    ),

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

    winner_id: finished
      ? firstScore > secondScore
        ? first.id
        : secondScore > firstScore
          ? second.id
          : null
      : null,

    faceit_url:
      `https://www.faceit.com/en/cs2/room/${match.id}`,

    raw_data: match,
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

  const first =
    normalizeFaction(firstRaw);

  const second =
    normalizeFaction(secondRaw);

  const firstScore = Number(
    data.results?.score?.faction1 ??
    firstRaw?.score ??
    0
  );

  const secondScore = Number(
    data.results?.score?.faction2 ??
    secondRaw?.score ??
    0
  );

  const status =
    data.status ||
    "UNKNOWN";

  const finished =
    FINISHED_STATUSES.has(
      status.toUpperCase()
    );

  const winnerFactionKey =
    data.results?.winner;

  return {
    status,

    best_of:
      data.best_of ??
      null,

    competition_name:
      data.competition_name ||
      data.competition?.name ||
      undefined,

    scheduled_at: asIso(
      data.scheduled_at
    ),

    started_at: asIso(
      data.started_at
    ),

    finished_at:
      asIso(data.finished_at) ||
      (
        finished
          ? new Date().toISOString()
          : undefined
      ),

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
      winnerFactionKey ===
      "faction1"
        ? first.id
        : winnerFactionKey ===
          "faction2"
          ? second.id
          : (
              finished
                ? firstScore >
                  secondScore
                  ? first.id
                  : secondScore >
                      firstScore
                    ? second.id
                    : null
                : null
            ),

    raw_data: data,
  };
}

function buildDiscoveryUrl(
  teamId,
  status,
  limit = 20
) {
  const params =
    new URLSearchParams();

  for (
    const item of CHAMPIONSHIPS
  ) {
    params.append(
      "championship_ids",
      item.id
    );
  }

  params.set(
    "entityId",
    teamId
  );

  params.set(
    "entityType",
    "PREMADE_TEAM"
  );

  params.set(
    "status",
    status
  );

  params.set(
    "offset",
    "0"
  );

  params.set(
    "limit",
    String(limit)
  );

  return (
    "https://www.faceit.com/api/team-leagues/v2/matches?" +
    params.toString()
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

function isRetryableFetchError(error) {
  const code =
    error?.cause?.code ||
    error?.code ||
    "";

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

async function fetchJson(
  url,
  options = {},
  attempts = 5
) {
  let lastError = null;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt += 1
  ) {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      FACEIT_FETCH_TIMEOUT_MS
    );

    try {
      const response = await fetch(
        url,
        {
          ...options,
          signal: controller.signal,
        }
      );

      if (response.ok) {
        return await response.json();
      }

      const body = (
        await response.text()
      ).slice(0, 500);

      const details = body
        ? `: ${body}`
        : "";

      const httpError = new Error(
        `${response.status} ` +
        `${response.statusText}` +
        details
      );

      httpError.status =
        response.status;

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

      if (
        !retryable ||
        attempt === attempts
      ) {
        throw error;
      }

      console.warn(
        `FACEIT request retry ${attempt}/${attempts} ` +
        `${url}: ${formatFetchError(error)}`
      );
    } finally {
      clearTimeout(timeout);
    }

    const delay =
      Math.min(
        10000,
        750 * 2 ** (attempt - 1)
      ) +
      Math.floor(
        Math.random() * 500
      );

    await sleep(delay);
  }

  throw lastError ||
    new Error(
      `FACEIT request failed: ${url}`
    );
}

function insideDiscoveryWindow(
  row
) {
  const value =
    row.finished_at ||
    row.scheduled_at;

  if (!value) {
    return false;
  }

  const time =
    new Date(value).getTime();

  if (Number.isNaN(time)) {
    return false;
  }

  const now = Date.now();

  if (
    FINISHED_STATUSES.has(
      String(
        row.status
      ).toUpperCase()
    )
  ) {
    return (
      time >=
        now -
          FINISHED_DAYS_BACK *
            86400000 &&
      time <=
        now + 3600000
    );
  }

  return (
    time >=
      now -
        LIVE_LOOKBACK_HOURS *
          3600000 &&
    time <=
      now +
        DISCOVERY_DAYS_AHEAD *
          86400000
  );
}

async function runPool(
  items,
  worker,
  size = concurrency
) {
  let cursor = 0;

  const runners = Array.from(
    {
      length: Math.min(
        size,
        Math.max(
          items.length,
          1
        )
      ),
    },
    async () => {
      while (
        cursor < items.length
      ) {
        const item =
          items[cursor++];

        await worker(item);
      }
    }
  );

  await Promise.all(runners);
}

async function discoverMatches() {
  const rows = new Map();

  const trackedTeams =
    teams.filter(
      (team) =>
        team.faceitTeamId
    );

  const jobs =
    trackedTeams.flatMap(
      (team) => [
        {
          team,
          status:
            "MATCH_STATUS_SCHEDULED",
          limit: 40,
        },
        {
          team,
          status:
            "MATCH_STATUS_FINISHED",
          limit: 10,
        },
      ]
    );

  await runPool(
    jobs,
    async (job) => {
      try {
        const data =
          await fetchJson(
            buildDiscoveryUrl(
              job.team
                .faceitTeamId,
              job.status,
              job.limit
            ),
            {
              headers: {
                accept:
                  "application/json",
                "user-agent":
                  "Mozilla/5.0 ESEA-Tracker/1.0",
              },
            }
          );

        const payload =
          Array.isArray(
            data.payload
          )
            ? data.payload
            : [];

        for (
          const match of payload
        ) {
          const row =
            internalToRow(match);

          if (
            row &&
            insideDiscoveryWindow(
              row
            )
          ) {
            rows.set(
              row.id,
              row
            );
          }
        }
      } catch (error) {
        console.warn(
          `Discovery failed for ` +
          `${job.team.name} ` +
          `(${job.status}): ` +
          error.message
        );
      }
    }
  );

  return [...rows.values()];
}

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

// Supabase returns timestamptz as "...+00:00" while asIso() produces
// "...Z" (via Date#toISOString()) — same instant, different string. Without
// normalizing, changed() would treat every timestamp field as "changed" on
// every comparison, even when nothing actually changed.
function normalizeCompareValue(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    /^\d{4}-\d{2}-\d{2}T/.test(
      String(value)
    )
  ) {
    const asDate = new Date(
      value
    );

    if (
      !Number.isNaN(
        asDate.getTime()
      )
    ) {
      return asDate.toISOString();
    }
  }

  return String(value);
}

function changed(
  existing,
  incoming
) {
  if (!existing) {
    return true;
  }

  // publicApiToPatch() never sets championship_id/faceit_url (Data API v4
  // doesn't carry them) — only compare fields the incoming patch actually
  // touches, not every COMPARE_FIELDS entry unconditionally.
  return COMPARE_FIELDS.filter(
    (field) =>
      Object.prototype.hasOwnProperty.call(
        incoming,
        field
      )
  ).some(
    (field) => {
      const before =
        normalizeCompareValue(
          existing[field] ??
          null
        );

      const after =
        normalizeCompareValue(
          incoming[field] ??
          null
        );

      return (
        before !== after
      );
    }
  );
}

// Discovery (internalToRow, above) assigns team1/team2 positionally from
// an internal FACEIT endpoint's `factions` array — an entirely different,
// uncoordinated source from the live-tick's public-API faction1/faction2
// keys. Both are internally self-consistent, but nothing keeps them
// agreeing on WHICH physical team is "team1" for a given match — so a
// discovery pass can (and does) flip a match back and forth every time it
// disagrees with whatever the live-tick last wrote, and vice versa. Fix:
// once a match has an established team1/team2 orientation in the DB,
// discovery must conform to it instead of overwriting it.
function alignToExistingOrientation(row, existing) {
  if (!existing || (!existing.team1_id && !existing.team1_name)) {
    return row;
  }

  const matchesTeam1 =
    (row.team1_id && existing.team1_id && row.team1_id === existing.team1_id) ||
    (!row.team1_id &&
      normalizeName(row.team1_name || "") ===
        normalizeName(existing.team1_name || ""));

  if (matchesTeam1) {
    return row;
  }

  const matchesTeam2AsTeam1 =
    (row.team1_id && existing.team2_id && row.team1_id === existing.team2_id) ||
    (!row.team1_id &&
      normalizeName(row.team1_name || "") ===
        normalizeName(existing.team2_name || ""));

  if (!matchesTeam2AsTeam1) {
    // Neither side lines up with what's already stored (e.g. a genuine
    // roster/team change) — nothing safe to normalize against, leave as-is.
    return row;
  }

  return {
    ...row,
    team1_id: row.team2_id,
    team1_name: row.team2_name,
    team1_slug: row.team2_slug,
    team1_logo: row.team2_logo,
    team1_score: row.team2_score,
    team2_id: row.team1_id,
    team2_name: row.team1_name,
    team2_slug: row.team1_slug,
    team2_logo: row.team1_logo,
    team2_score: row.team1_score,
  };
}

async function upsertOnlyChanged(
  rows
) {
  if (!rows.length) {
    return {
      insertedOrChanged: 0,
      unchanged: 0,
    };
  }

  const ids = rows.map(
    (row) => row.id
  );

  const existingById =
    new Map();

  for (
    let index = 0;
    index < ids.length;
    index += 200
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("matches")
      .select(
        COMPARE_FIELDS
          .concat("id")
          .join(",")
      )
      .in(
        "id",
        ids.slice(
          index,
          index + 200
        )
      );

    if (error) {
      throw error;
    }

    for (
      const row of data || []
    ) {
      existingById.set(
        row.id,
        row
      );
    }
  }

  const alignedRows = rows.map(
    (row) =>
      alignToExistingOrientation(
        row,
        existingById.get(row.id)
      )
  );

  const changedRows = alignedRows
    .filter((row) =>
      changed(
        existingById.get(
          row.id
        ),
        row
      )
    )
    .map((row) => ({
      ...row,
      updated_at:
        new Date().toISOString(),
    }));

  for (
    let index = 0;
    index < changedRows.length;
    index += 200
  ) {
    const { error } =
      await supabase
        .from("matches")
        .upsert(
          changedRows.slice(
            index,
            index + 200
          ),
          {
            onConflict: "id",
          }
        );

    if (error) {
      throw error;
    }
  }

  return {
    insertedOrChanged:
      changedRows.length,

    unchanged:
      rows.length -
      changedRows.length,
  };
}

async function loadRefreshCandidates() {
  const now = Date.now();

  const from = new Date(
    now -
    LIVE_LOOKBACK_HOURS *
      3600000
  ).toISOString();

  const to = new Date(
    now +
    LIVE_LOOKAHEAD_HOURS *
      3600000
  ).toISOString();

  const {
    data,
    error,
  } = await supabase
    .from("matches")
    .select(
      COMPARE_FIELDS
        .concat("id")
        .join(",")
    )
    .in(
      "status",
      ACTIVE_STATUSES
    )
    .gte(
      "scheduled_at",
      from
    )
    .lte(
      "scheduled_at",
      to
    )
    .order(
      "scheduled_at",
      {
        ascending: true,
      }
    )
    .limit(300);

  if (error) {
    throw error;
  }

  return data || [];
}

// Matches worth fetching stats for — narrower than FINISHED_STATUSES, which
// also includes CANCELLED (relevant for finished_at/winner_id elsewhere,
// not for stats: a cancelled match has no map/player stats to sync).
const STATS_ELIGIBLE_STATUSES =
  new Set([
    "FINISHED",
    "MATCH_STATUS_FINISHED",
  ]);

// Producer #2 (see also worker.js — same hook, this one is the fallback in
// case worker.js is down when a match finishes). Best-effort: match_stat_jobs
// is an optional acceleration layer, not the only path to stats — the
// existing stats_synced=false scan later in this file remains the safety
// net regardless of this insert's outcome, so a failure here must never
// break the refresh loop.
async function createStatJobIfFinished(
  matchId,
  status
) {
  if (
    !STATS_ELIGIBLE_STATUSES.has(
      String(
        status
      ).toUpperCase()
    )
  ) {
    return;
  }

  try {
    const { error } =
      await supabase
        .from(
          "match_stat_jobs"
        )
        .upsert(
          {
            match_id: matchId,
            job_type: "stats_sync",
          },
          {
            onConflict:
              "match_id,job_type",
            ignoreDuplicates: true,
          }
        );

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn(
      `Failed to enqueue stats job for ${matchId}: ` +
      formatFetchError(error)
    );
  }
}

async function refreshActive() {
  const candidates =
    await loadRefreshCandidates();

  let changedCount = 0;
  let unchangedCount = 0;
  let failed = 0;

  await runPool(
    candidates,
    async (match) => {
      try {
        await sleep(
          150 +
          Math.floor(
            Math.random() * 350
          )
        );

        const payload =
          await fetchJson(
            `https://open.faceit.com/data/v4/matches/${encodeURIComponent(
              match.id
            )}`,
            {
              headers: {
                Authorization:
                  `Bearer ${faceitApiKey}`,
                Accept:
                  "application/json",
              },
            }
          );

        const patch =
          publicApiToPatch(
            payload
          );

        if (!patch) {
          return;
        }

        const clean =
          Object.fromEntries(
            Object.entries(
              patch
            ).filter(
              ([, value]) =>
                value !==
                undefined
            )
          );

        if (
          !changed(
            match,
            clean
          )
        ) {
          unchangedCount += 1;
          return;
        }

        clean.updated_at =
          new Date().toISOString();

        const { error } =
          await supabase
            .from("matches")
            .update(clean)
            .eq(
              "id",
              match.id
            );

        if (error) {
          throw error;
        }

        changedCount += 1;

        await createStatJobIfFinished(
          match.id,
          clean.status
        );
      } catch (error) {
        failed += 1;

        console.warn(
          `Refresh failed ${match.id}: ` +
          formatFetchError(error)
        );
      }
    },
    REFRESH_CONCURRENCY
  );

  return {
    candidates:
      candidates.length,

    changed:
      changedCount,

    unchanged:
      unchangedCount,

    failed,
  };
}

async function fetchInternalStatsV3(matchId) {
  const url =
    `https://www.faceit.com/api/stats/v3/matches/${encodeURIComponent(
      matchId
    )}`;

  const payload = await fetchJson(
    url,
    {
      headers: {
        Accept: "application/json, text/plain, */*",

        ...(faceitSessionCookie
          ? {
              Cookie:
                faceitSessionCookie,
            }
          : {}),

        Referer:
          `https://www.faceit.com/en/cs2/room/${encodeURIComponent(
            matchId
          )}`,

        "User-Agent":
          process.env.FACEIT_USER_AGENT ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",

        "Accept-Language":
          "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",

        "Faceit-Referer":
          "web-next",

        "X-Requested-With":
          "XMLHttpRequest",
      },
    },
    4
  );

  return payload;
}


function normalizeMatchRosterPlayer(
  player = {}
) {
  const faceitId =
    player.player_id ||
    player.playerId ||
    player.user_id ||
    player.userId ||
    player.id ||
    null;

  if (!faceitId) {
    return null;
  }

  return {
    playerId: faceitId,

    nickname:
      player.nickname ||
      player.player_name ||
      player.playerName ||
      player.name ||
      null,
  };
}

function extractLineupsFromMatchPayload(
  payload
) {
  const result = [];

  const pushTeam = (
    teamNode,
    fallbackId = null,
    fallbackName = null
  ) => {
    if (!teamNode) {
      return;
    }

    const teamId =
      teamNode.faction_id ||
      teamNode.premade_team_id ||
      teamNode.team_id ||
      teamNode.teamId ||
      teamNode.id ||
      fallbackId ||
      null;

    const teamName =
      teamNode.name ||
      teamNode.nickname ||
      teamNode.team_name ||
      teamNode.teamName ||
      fallbackName ||
      "Unknown";

    const candidates = [
      teamNode.roster,
      teamNode.players,
      teamNode.members,
    ];

    const playerMap = new Map();

    for (const candidate of candidates) {
      if (!Array.isArray(candidate)) {
        continue;
      }

      for (const rawPlayer of candidate) {
        const player =
          normalizeMatchRosterPlayer(
            rawPlayer
          );

        if (
          player &&
          !playerMap.has(
            player.playerId
          )
        ) {
          playerMap.set(
            player.playerId,
            player
          );
        }
      }
    }

    if (
      teamId &&
      playerMap.size > 0
    ) {
      result.push({
        teamId,
        teamName,
        players:
          [...playerMap.values()],
      });
    }
  };

  /*
   * Open FACEIT API v4:
   * teams = { faction1: {...}, faction2: {...} }
   */
  if (
    payload?.teams &&
    !Array.isArray(payload.teams)
  ) {
    for (
      const [key, teamNode]
      of Object.entries(payload.teams)
    ) {
      pushTeam(
        teamNode,
        key,
        teamNode?.name
      );
    }
  }

  /*
   * Internal match-room payload:
   * factions = [...]
   */
  if (
    Array.isArray(payload?.factions)
  ) {
    for (
      const teamNode
      of payload.factions
    ) {
      pushTeam(teamNode);
    }
  }

  /*
   * Some payloads expose team1/team2.
   */
  pushTeam(payload?.team1);
  pushTeam(payload?.team2);

  const deduplicated = new Map();

  for (const team of result) {
    if (
      !deduplicated.has(
        team.teamId
      )
    ) {
      deduplicated.set(
        team.teamId,
        {
          ...team,
          players:
            new Map(),
        }
      );
    }

    const target =
      deduplicated.get(
        team.teamId
      );

    for (
      const player
      of team.players
    ) {
      target.players.set(
        player.playerId,
        player
      );
    }
  }

  return [
    ...deduplicated.values(),
  ].map((team) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    players:
      [...team.players.values()],
  }));
}

function resolveLineupTeamId(
  lineupTeam,
  match
) {
  if (
    lineupTeam.teamId ===
    match.team1_id
  ) {
    return match.team1_id;
  }

  if (
    lineupTeam.teamId ===
    match.team2_id
  ) {
    return match.team2_id;
  }

  if (
    lineupTeam.teamName &&
    match.team1_name &&
    normalizeName(
      lineupTeam.teamName
    ) ===
      normalizeName(
        match.team1_name
      )
  ) {
    return match.team1_id;
  }

  if (
    lineupTeam.teamName &&
    match.team2_name &&
    normalizeName(
      lineupTeam.teamName
    ) ===
      normalizeName(
        match.team2_name
      )
  ) {
    return match.team2_id;
  }

  return lineupTeam.teamId || null;
}

async function saveLineupsFromPayload({
  match,
  payload,
  source,
}) {
  const lineups =
    extractLineupsFromMatchPayload(
      payload
    );

  if (!lineups.length) {
    return {
      teams: 0,
      players: 0,
      appearances: 0,
      source,
    };
  }

  let teamsSaved = 0;
  let playersSaved = 0;
  let appearancesSaved = 0;

  for (
    const lineupTeam
    of lineups
  ) {
    const teamId =
      resolveLineupTeamId(
        lineupTeam,
        match
      );

    if (!teamId) {
      continue;
    }

    let teamPlayerCount = 0;

    for (
      const player
      of lineupTeam.players
    ) {
      const databasePlayer =
        await upsertRosterPlayer(
          player
        );

      if (!databasePlayer?.id) {
        continue;
      }

      await ensureTeamPlayerRelation(
        teamId,
        databasePlayer.id
      );

      const inserted =
        await savePlayerAppearance({
          matchId: match.id,
          teamId,
          databasePlayerId:
            databasePlayer.id,
          playedAt:
            match.finished_at ||
            match.started_at ||
            match.scheduled_at ||
            new Date().toISOString(),
        });

      playersSaved += 1;
      teamPlayerCount += 1;

      if (inserted) {
        appearancesSaved += 1;
      }
    }

    if (teamPlayerCount > 0) {
      teamsSaved += 1;
    }
  }

  return {
    teams: teamsSaved,
    players: playersSaved,
    appearances:
      appearancesSaved,
    source,
  };
}

async function fetchMatchRoomPayload(
  matchId
) {
  return fetchJson(
    `https://open.faceit.com/data/v4/matches/${encodeURIComponent(
      matchId
    )}`,
    {
      headers: {
        Authorization:
          `Bearer ${faceitApiKey}`,
        Accept:
          "application/json",
      },
    },
    3
  );
}

async function syncFinishedLineups() {
  const from =
    new Date(
      Date.now() -
        LINEUP_SYNC_DAYS_BACK *
          86400000
    ).toISOString();

  const {
    data: matches,
    error,
  } = await supabase
    .from("matches")
    .select(
      [
        "id",
        "status",
        "scheduled_at",
        "started_at",
        "finished_at",
        "team1_id",
        "team1_name",
        "team2_id",
        "team2_name",
        "raw_data",
      ].join(",")
    )
    .in("status", [
      "FINISHED",
      "MATCH_STATUS_FINISHED",
    ])
    .gte("finished_at", from)
    .order(
      "finished_at",
      {
        ascending: false,
        nullsFirst: false,
      }
    )
    .limit(
      LINEUP_SYNC_BATCH_SIZE
    );

  if (error) {
    throw error;
  }

  let candidates = 0;
  let fromRawData = 0;
  let fromMatchApi = 0;
  let empty = 0;
  let failed = 0;
  let appearances = 0;

  await runPool(
    matches || [],
    async (match) => {
      candidates += 1;

      try {
        let result =
          await saveLineupsFromPayload({
            match,
            payload:
              match.raw_data || {},
            source: "raw_data",
          });

        if (
          result.players > 0
        ) {
          fromRawData += 1;
          appearances +=
            result.appearances;
          return;
        }

        const matchPayload =
          await fetchMatchRoomPayload(
            match.id
          );

        result =
          await saveLineupsFromPayload({
            match,
            payload:
              matchPayload,
            source:
              "open-data-v4-match",
          });

        if (
          result.players > 0
        ) {
          fromMatchApi += 1;
          appearances +=
            result.appearances;
        } else {
          empty += 1;

          console.warn(
            `Lineup unavailable ${match.id}`
          );
        }
      } catch (error) {
        failed += 1;

        console.warn(
          `Lineup sync failed ` +
          `${match.id}: ` +
          error.message
        );
      }
    },
    Math.min(
      concurrency,
      4
    )
  );

  return {
    candidates,
    fromRawData,
    fromMatchApi,
    empty,
    failed,
    appearances,
  };
}

async function fetchFinishedMatchStats(
  matchId
) {
  /*
   * Основной источник: официальный Data API v4.
   * Не требует cookie, не блокируется Cloudflare
   * (в отличие от внутренних эндпоинтов ниже),
   * и один ответ уже содержит и карты,
   * и статистику игроков (Kills/Deaths/Assists/
   * ADR/K-D/Headshots %/MVPs) — см. audit.
   */
  let officialRounds = [];
  let officialPlayerStats = null;
  let officialError = null;

  try {
    const officialUrl =
      `https://open.faceit.com/data/v4/matches/${encodeURIComponent(
        matchId
      )}/stats`;

    const officialPayload =
      await fetchJson(
        officialUrl,
        {
          headers: {
            Authorization:
              `Bearer ${faceitApiKey}`,
            Accept:
              "application/json",
          },
        }
      );

    const official =
      normalizeOfficialMatchStats(
        officialPayload,
        matchId
      );

    officialRounds = official.rounds;
    officialPlayerStats =
      official.playerStats;
  } catch (error) {
    officialError = error;

    console.warn(
      `Official stats unavailable ` +
      `${matchId}: ` +
      error.message
    );
  }

  /*
   * Внутренний stats/v3 — fallback, не удалён.
   * Пробуем только если официальный API не отдал
   * карты и/или статистику игроков (например,
   * ещё не опубликована, либо Cloudflare пропустит
   * запрос в будущем).
   */
  let internalRounds = [];
  let internalPlayerStats = null;
  let internalError = null;

  if (
    !officialRounds.length ||
    !officialPlayerStats
  ) {
    try {
      const internalPayload =
        await fetchInternalStatsV3(
          matchId
        );

      internalRounds =
        normalizeInternalMatchStats(
          internalPayload
        );

      internalPlayerStats =
        normalizeInternalPlayerStats(
          internalPayload,
          matchId
        );
    } catch (error) {
      internalError = error;

      console.warn(
        `Internal stats/v3 unavailable ` +
        `${matchId}: ` +
        error.message
      );
    }
  }

  /*
   * Scoreboard-summary — последний fallback
   * для игроков, если ни официальный API,
   * ни stats/v3 не отдали статистику игроков.
   */
  let scoreboardPlayerStats = null;

  if (
    !officialPlayerStats &&
    !internalPlayerStats
  ) {
    try {
      const expectedRoundCount =
        officialRounds.length ||
        internalRounds.length;

      const scoreboardPayloads =
        await fetchScoreboardSummaries(
          matchId,
          expectedRoundCount
        );

      scoreboardPlayerStats =
        normalizeScoreboardSummaries(
          scoreboardPayloads,
          matchId
        );
    } catch (error) {
      console.warn(
        `Scoreboard stats unavailable ` +
        `${matchId}: ` +
        error.message
      );
    }
  }

  const rounds =
    officialRounds.length
      ? officialRounds
      : internalRounds;

  const playerStats =
    officialPlayerStats ||
    internalPlayerStats ||
    scoreboardPlayerStats;

  if (
    !rounds.length &&
    !playerStats
  ) {
    throw (
      officialError ||
      internalError ||
      new Error(
        "No match maps or player statistics returned"
      )
    );
  }

  return {
    source:
      officialRounds.length &&
      officialPlayerStats
        ? "data-v4"
        : officialRounds.length &&
            internalPlayerStats
          ? "data-v4 + stats-v3"
          : officialRounds.length &&
              scoreboardPlayerStats
            ? "data-v4 + statistics-v1"
            : internalRounds.length &&
                internalPlayerStats
              ? "stats-v3"
              : internalRounds.length &&
                  scoreboardPlayerStats
                ? "stats-v3 + statistics-v1"
                : officialPlayerStats
                  ? "data-v4-players"
                  : internalPlayerStats
                    ? "stats-v3-players"
                    : scoreboardPlayerStats
                      ? "statistics-v1"
                      : officialRounds.length
                        ? "data-v4-maps"
                        : "stats-v3-maps",

    rounds,
    playerStats,
  };
}

async function syncFinishedMapStats() {
  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      [
        "id",
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
        "finished_at",
      ].join(",")
    )
    .in("status", [
      "FINISHED",
      "MATCH_STATUS_FINISHED",
    ])
    .eq("stats_synced", false)
    .eq("stats_unavailable", false)
    .order("finished_at", {
      ascending: true,
      nullsFirst: false,
    })
    .limit(MAP_STATS_BATCH_SIZE);

  if (error) {
    throw error;
  }

  let synced = 0;
  let empty = 0;
  let failed = 0;

  await runPool(matches || [], async (match) => {
    try {
      /*
       * Небольшой jitter снижает риск 429
       * при одновременной обработке матчей.
       */
      await sleep(
        Math.floor(
          150 + Math.random() * 350
        )
      );

      const statsResult =
        await fetchFinishedMatchStats(match.id);

      const mapScores = mapsForMatch(
        statsResult.rounds,
        match
      );

      const firstMap = mapScores[0] || null;

      const statsTeams = Array.isArray(
        statsResult.playerStats?.teams
      )
        ? statsResult.playerStats.teams
        : [];

      /*
       * Определяем первую команду.
       * Сначала ищем по существующему ID.
       * Потом по имени.
       * Потом по ID из первой карты.
       */
      let firstStatsTeam =
        statsTeams.find(
          (team) =>
            match.team1_id &&
            team.teamId === match.team1_id
        ) ||
        statsTeams.find(
          (team) =>
            match.team1_name &&
            normalizeName(team.teamName) ===
              normalizeName(match.team1_name)
        ) ||
        statsTeams.find(
          (team) =>
            firstMap?.team1_id &&
            team.teamId === firstMap.team1_id
        ) ||
        statsTeams[0] ||
        null;

      /*
       * Вторая команда — команда, которая не является первой.
       */
      let secondStatsTeam =
        statsTeams.find(
          (team) =>
            firstStatsTeam &&
            team.teamId !== firstStatsTeam.teamId
        ) ||
        statsTeams.find(
          (team) =>
            firstMap?.team2_id &&
            team.teamId === firstMap.team2_id
        ) ||
        statsTeams[1] ||
        null;

      const resolvedTeam1Id =
        match.team1_id ||
        firstStatsTeam?.teamId ||
        firstMap?.team1_id ||
        null;

      const resolvedTeam2Id =
        match.team2_id ||
        secondStatsTeam?.teamId ||
        firstMap?.team2_id ||
        null;

      const resolvedTeam1Name =
        firstStatsTeam?.teamName ||
        firstMap?.team1_name ||
        match.team1_name ||
        "TBD";

      const resolvedTeam2Name =
        secondStatsTeam?.teamName ||
        firstMap?.team2_name ||
        match.team2_name ||
        "TBD";

      /*
       * Находим локальные команды, чтобы сохранить slug и logo.
       */
      const resolvedLocalTeam1 = localTeam(
        resolvedTeam1Id,
        resolvedTeam1Name
      );

      const resolvedLocalTeam2 = localTeam(
        resolvedTeam2Id,
        resolvedTeam2Name
      );

      /*
       * Если команды в статистике пришли в обратном порядке,
       * переориентируем map_scores.
       */
      const correctedMapScores = mapScores.map(
        (map) => {
          if (
            resolvedTeam1Id &&
            map.team2_id === resolvedTeam1Id
          ) {
            return {
              map: map.map,
              order: map.order,

              team1_id: map.team2_id,
              team1_name: map.team2_name,
              team1_score: map.team2_score,

              team2_id: map.team1_id,
              team2_name: map.team1_name,
              team2_score: map.team1_score,

              winner_id: map.winner_id,
            };
          }

          return map;
        }
      );

      const hasMaps =
        correctedMapScores.length > 0;

      const hasPlayerStats =
        statsTeams.length >= 2 &&
        statsTeams.every(
          (team) =>
            Array.isArray(team.players) &&
            team.players.length > 0
        );

      let resolvedWinnerId =
        match.winner_id || null;

      if (
        Number(match.team1_score) >
        Number(match.team2_score)
      ) {
        resolvedWinnerId = resolvedTeam1Id;
      } else if (
        Number(match.team2_score) >
        Number(match.team1_score)
      ) {
        resolvedWinnerId = resolvedTeam2Id;
      }

      const patch = {
        team1_id: resolvedTeam1Id,
        team1_name:
          resolvedLocalTeam1?.name ||
          resolvedTeam1Name,
        team1_slug:
          resolvedLocalTeam1?.slug ||
          match.team1_slug ||
          null,
        team1_logo:
          resolvedLocalTeam1?.logo ||
          match.team1_logo ||
          null,

        team2_id: resolvedTeam2Id,
        team2_name:
          resolvedLocalTeam2?.name ||
          resolvedTeam2Name,
        team2_slug:
          resolvedLocalTeam2?.slug ||
          match.team2_slug ||
          null,
        team2_logo:
          resolvedLocalTeam2?.logo ||
          match.team2_logo ||
          null,

        winner_id: resolvedWinnerId,

        map_scores: correctedMapScores,

        maps: correctedMapScores.map(
          (item) => item.map
        ),

        player_stats: hasPlayerStats
          ? {
              ...statsResult.playerStats,
              maps: correctedMapScores,
            }
          : null,

        stats_synced:
          hasMaps && hasPlayerStats,

        stats_synced_at:
          hasMaps && hasPlayerStats
            ? new Date().toISOString()
            : null,

        updated_at:
          new Date().toISOString(),
      };

      const { error: updateError } =
  await supabase
    .from("matches")
    .update(patch)
    .eq("id", match.id);

if (updateError) {
  throw updateError;
}

if (hasPlayerStats && RUN_PLAYER_SYNC) {
  try {
    await updateTeamRosterFromPlayerStats({
      matchId: match.id,

      playerStats:
        statsResult.playerStats,

      playedAt:
        match.finished_at ||
        new Date().toISOString(),

      team1Id:
        resolvedTeam1Id,

      team1Name:
        resolvedLocalTeam1?.name ||
        resolvedTeam1Name,

      team2Id:
        resolvedTeam2Id,

      team2Name:
        resolvedLocalTeam2?.name ||
        resolvedTeam2Name,
    });
  } catch (rosterError) {
    console.error(
      `Roster sync failed ${match.id}:`,
      rosterError
    );
  }
}

      if (hasMaps && hasPlayerStats) {
        synced += 1;

        const playerCount =
          statsTeams.reduce(
            (total, team) =>
              total + team.players.length,
            0
          );

        console.log(
          `Match stats synced ${match.id}: ` +
            `${correctedMapScores.length} map(s), ` +
            `${playerCount} player record(s), ` +
            `team1=${resolvedTeam1Id}, ` +
            `team2=${resolvedTeam2Id}, ` +
            `source=${statsResult.source}`
        );
      } else {
        empty += 1;

        console.warn(
          `Match stats incomplete ${match.id}: ` +
            `maps=${hasMaps}, ` +
            `players=${hasPlayerStats}, ` +
            `team1=${resolvedTeam1Id}, ` +
            `team2=${resolvedTeam2Id}, ` +
            `source=${statsResult.source}`
        );
      }
    } catch (syncError) {
      failed += 1;

      console.warn(
        `Match stats failed ${match.id}: ` +
          syncError.message
      );
    }
  });

  return {
    candidates: (matches || []).length,
    synced,
    empty,
    failed,
  };
}


async function runNodePipelineScript({
  label,
  script,
  args = [],
}) {
  if (!existsSync(script)) {
    return {
      ran: false,
      reason: "script-not-found",
      script,
    };
  }

  console.log(`\n=== ${label} ===`);

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--env-file-if-exists=.env.local",
        script,
        ...args,
      ],
      {
        stdio: "inherit",
        shell: false,
        env: process.env,
      }
    );

    child.on("error", reject);

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${label} exited with code ${code}`
        )
      );
    });
  });

  return {
    ran: true,
    reason: "completed",
    script,
  };
}

async function runPlayerRatingPipeline() {
  if (!RUN_PLAYER_RATINGS_AFTER_SYNC) {
    return {
      ran: false,
      reason: "disabled",
    };
  }

  return runNodePipelineScript({
    label: "Player rating recalculation",
    script: PLAYER_RATING_SCRIPT,
  });
}

async function runStartingLineupPipeline() {
  if (!RUN_LINEUP_SYNC) {
    return {
      ran: false,
      reason: "disabled",
    };
  }

  return runNodePipelineScript({
    label: "Starting lineup update",
    script: STARTING_LINEUP_SCRIPT,
  });
}

async function runAutomaticRatingPipeline() {
  if (!RUN_RATINGS_AFTER_SYNC) {
    return {
      ran: false,
      reason: "disabled",
    };
  }

  const result =
    await runNodePipelineScript({
      label: "Automatic rating update",
      script: AUTOMATIC_RATING_SCRIPT,
    });

  if (!result.ran) {
    return result;
  }

  let deltaSnapshot = {
    ran: false,
    reason: "not-attempted",
  };

  try {
    deltaSnapshot = await runNodePipelineScript({
      label: "Rating delta snapshot (weekly view)",
      script: RATING_DELTA_SNAPSHOT_SCRIPT,
    });
  } catch (deltaSnapshotError) {
    deltaSnapshot = {
      ran: false,
      reason: "failed",
      error:
        deltaSnapshotError?.message ||
        String(deltaSnapshotError),
    };

    console.error(
      "Rating delta snapshot failed:",
      deltaSnapshotError
    );
  }

  return {
    ...result,
    reason: "new-finished-match-stats",
    deltaSnapshot,
  };
}


function getIsoWeekStart(date = new Date()) {
  const value = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );

  const isoDay =
    value.getUTCDay() || 7;

  value.setUTCDate(
    value.getUTCDate() -
      isoDay +
      1
  );

  return value
    .toISOString()
    .slice(0, 10);
}

async function runWeeklyRatingSnapshotIfNeeded() {
  if (!RUN_WEEKLY_RATING_SNAPSHOT) {
    return {
      ran: false,
      reason: "disabled",
    };
  }

  const now = new Date();

  if (
    now.getUTCDay() !==
    WEEKLY_RATING_SNAPSHOT_DAY_UTC
  ) {
    return {
      ran: false,
      reason: "not-snapshot-day",
      dayUtc:
        now.getUTCDay(),
      configuredDayUtc:
        WEEKLY_RATING_SNAPSHOT_DAY_UTC,
    };
  }

  const weekStart =
    getIsoWeekStart(now);

  const {
    data,
    error,
  } = await supabase
    .from("team_rating_history")
    .select("id")
    .eq(
      "snapshot_type",
      "weekly"
    )
    .eq(
      "week_start",
      weekStart
    )
    .limit(1);

  if (error) {
    throw new Error(
      `Weekly snapshot lookup failed: ${error.message}`
    );
  }

  if (
    Array.isArray(data) &&
    data.length > 0
  ) {
    return {
      ran: false,
      reason: "already-created",
      weekStart,
    };
  }

  const result =
    await runNodePipelineScript({
      label: "Weekly rating snapshot",
      script:
        WEEKLY_RATING_SNAPSHOT_SCRIPT,
    });

  return {
    ...result,
    weekStart,
  };
}

async function main() {
  const started = Date.now();

  let discovery = null;

  if (mode === "full" && !postMatchOnly) {
    const discovered =
      await discoverMatches();

    discovery = {
      found:
        discovered.length,

      ...(
        await upsertOnlyChanged(
          discovered
        )
      ),
    };
  }

  const refresh = postMatchOnly
    ? {
        candidates: 0,
        changed: 0,
        unchanged: 0,
        failed: 0,
        skipped: "post-match-only",
      }
    : await refreshActive();

  let lineups = {
    ran: false,
    reason: RUN_POST_MATCH_PIPELINE
      ? "disabled"
      : "post-match-pipeline-disabled",
  };

  let matchStats = {
    ran: false,
    reason: "post-match-pipeline-disabled",
    candidates: 0,
    synced: 0,
    empty: 0,
    failed: 0,
  };

  let playerRatingUpdate = {
    ran: false,
    reason: "no-new-finished-match-stats",
  };

  let startingLineups = {
    ran: false,
    reason: "no-new-finished-match-stats",
  };

  let ratingUpdate = {
    ran: false,
    reason: "no-new-finished-match-stats",
  };


  let weeklyRatingSnapshot = {
    ran: false,
    reason: "not-checked",
  };

  if (RUN_POST_MATCH_PIPELINE) {
    /*
     * Составы из матч-румов и raw_data.
     */
    if (RUN_LINEUP_SYNC) {
      lineups = {
        ran: true,
        ...(
          await syncFinishedLineups()
        ),
      };
    } else {
      lineups = {
        ran: false,
        reason: "disabled",
      };
    }

    /*
     * Карты и статистика игроков.
     * RUN_PLAYER_SYNC отдельно управляет записью
     * players/team_players/appearances внутри функции.
     */
    matchStats = {
      ran: true,
      ...(
        await syncFinishedMapStats()
      ),
    };

    /*
     * Пересчитываем стартовые пятёрки и рейтинг
     * только после фактически синхронизированных
     * завершённых матчей.
     */
    if (
      Number(matchStats?.synced || 0) > 0
    ) {
      try {
        playerRatingUpdate =
          await runPlayerRatingPipeline();
      } catch (playerRatingError) {
        playerRatingUpdate = {
          ran: false,
          reason: "failed",
          error:
            playerRatingError?.message ||
            String(playerRatingError),
        };

        console.error(
          "Player rating recalculation failed:",
          playerRatingError
        );
      }

      try {
        startingLineups =
          await runStartingLineupPipeline();
      } catch (lineupError) {
        startingLineups = {
          ran: false,
          reason: "failed",
          error:
            lineupError?.message ||
            String(lineupError),
        };

        console.error(
          "Starting lineup update failed:",
          lineupError
        );
      }

      try {
        ratingUpdate =
          await runAutomaticRatingPipeline();
      } catch (ratingError) {
        ratingUpdate = {
          ran: false,
          reason: "failed",
          error:
            ratingError?.message ||
            String(ratingError),
        };

        console.error(
          "Automatic rating update failed:",
          ratingError
        );
      }
    }
  }

  /*
   * Один и тот же cron синхронизации матчей
   * создаёт недельную точку рейтинга.
   * Скрипт запускается только в выбранный день UTC
   * и только если снимка за эту ISO-неделю ещё нет.
   */
  try {
    weeklyRatingSnapshot =
      await runWeeklyRatingSnapshotIfNeeded();
  } catch (weeklySnapshotError) {
    weeklyRatingSnapshot = {
      ran: false,
      reason: "failed",
      error:
        weeklySnapshotError?.message ||
        String(weeklySnapshotError),
    };

    console.error(
      "Weekly rating snapshot failed:",
      weeklySnapshotError
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode,
        discovery,
        refresh,

        postMatchPipeline: {
          enabled:
            RUN_POST_MATCH_PIPELINE,
          playerSync:
            RUN_PLAYER_SYNC,
          lineupSync:
            RUN_LINEUP_SYNC,
          ratingsAfterSync:
            RUN_RATINGS_AFTER_SYNC,
        },

        lineups,
        matchStats,
        playerRatingUpdate,
        startingLineups,
        ratingUpdate,
        weeklyRatingSnapshot,

        durationMs:
          Date.now() -
          started,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    "Automatic match sync failed:",
    error
  );

  process.exitCode = 1;
});