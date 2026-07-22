import { createClient } from "@supabase/supabase-js";
import { calculatePlayerMatchRating } from "../src/utils/calculatePlayerRating.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

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

const PAGE_SIZE = Math.max(
  100,
  Number(
    process.env.PLAYER_RATING_MATCH_PAGE_SIZE || 500
  )
);

const WRITE_BATCH_SIZE = Math.max(
  50,
  Number(
    process.env.PLAYER_RATING_WRITE_BATCH_SIZE || 200
  )
);

const RECENT_MATCH_COUNT = Math.max(
  1,
  Number(
    process.env.PLAYER_RATING_RECENT_MATCH_COUNT || 10
  )
);

const MIN_MATCHES = Math.max(
  1,
  Number(
    process.env.PLAYER_RATING_MIN_MATCHES || 1
  )
);

const FULL_MODE = process.argv.includes("--full");
const SINCE_HOURS_ARG = process.argv.find((arg) =>
  arg.startsWith("--since-hours=")
);
const SINCE_HOURS = Math.max(
  1,
  Number(
    SINCE_HOURS_ARG?.split("=")[1] ||
      process.env.POST_MATCH_LOOKBACK_HOURS ||
      24
  )
);

function parseJson(value) {
  if (!value) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeId(value) {
  const result =
    String(value || "").trim();

  return result || null;
}

function normalizePlayer(raw = {}) {
  const nested =
    raw.player_stats ||
    raw.playerStats ||
    raw.stats ||
    raw;

  const playerId = normalizeId(
    raw.playerId ||
    raw.player_id ||
    raw.faceit_id ||
    raw.faceitId ||
    raw.id
  );

  if (!playerId) {
    return null;
  }

  return {
    playerId,

    nickname:
      raw.nickname ||
      raw.player_name ||
      raw.playerName ||
      nested.Nickname ||
      "Unknown",

    kills:
      nested.kills ??
      nested.Kills ??
      raw.kills ??
      0,

    deaths:
      nested.deaths ??
      nested.Deaths ??
      raw.deaths ??
      0,

    assists:
      nested.assists ??
      nested.Assists ??
      raw.assists ??
      0,

    adr:
      nested.adr ??
      nested.ADR ??
      nested["Average Damage per Round"] ??
      raw.adr ??
      0,

    kd:
      nested.kd ??
      nested["K/D Ratio"] ??
      nested["K/D"] ??
      raw.kd ??
      0,

    mvps:
      nested.mvps ??
      nested.MVPs ??
      nested.MVP ??
      raw.mvps ??
      0,

    entryDiff:
      nested.entryDiff ??
      nested.entry_diff ??
      nested["Entry Diff"] ??
      raw.entryDiff ??
      0,

    clutchRoundsWon:
      nested.clutchRoundsWon ??
      nested.clutch_rounds_won ??
      nested["Clutch Rounds Won"] ??
      raw.clutchRoundsWon ??
      0,

    "2k":
      nested["2k"] ??
      nested.twoKs ??
      raw["2k"] ??
      0,

    "3k":
      nested["3k"] ??
      nested.threeKs ??
      raw["3k"] ??
      0,

    "4k":
      nested["4k"] ??
      nested.fourKs ??
      raw["4k"] ??
      0,

    aces:
      nested.aces ??
      nested["5k"] ??
      raw.aces ??
      0,
  };
}

function extractPlayers(payload) {
  const parsed = parseJson(payload);

  if (!parsed) {
    return [];
  }

  const players = [];

  const teams = Array.isArray(parsed.teams)
    ? parsed.teams
    : [];

  for (const team of teams) {
    for (const raw of Array.isArray(team?.players)
      ? team.players
      : []) {
      const player = normalizePlayer(raw);

      if (player) {
        players.push(player);
      }
    }
  }

  return players;
}

async function loadAllFinishedMatches() {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("matches")
      .select(
        "id,finished_at,player_stats"
      )
      .in("status", [
        "FINISHED",
        "MATCH_STATUS_FINISHED",
      ])
      .not("player_stats", "is", null)
      .order("finished_at", {
        ascending: true,
        nullsFirst: false,
      })
      .range(
        from,
        from + PAGE_SIZE - 1
      );

    if (error) {
      throw new Error(
        `Unable to load matches: ${error.message}`
      );
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

async function loadRecentlySyncedMatches() {
  const cutoff = new Date(
    Date.now() - SINCE_HOURS * 60 * 60 * 1000
  ).toISOString();

  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("matches")
      .select("id,finished_at,stats_synced_at,player_stats")
      .in("status", ["FINISHED", "MATCH_STATUS_FINISHED"])
      .not("player_stats", "is", null)
      .gte("stats_synced_at", cutoff)
      .order("stats_synced_at", {
        ascending: false,
        nullsFirst: false,
      })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Unable to load recently synced matches: ${error.message}`
      );
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

function collectPlayerIds(matches) {
  const ids = new Set();

  for (const match of matches) {
    for (const player of extractPlayers(match.player_stats)) {
      ids.add(player.playerId);
    }
  }

  return ids;
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

async function main() {
  const recentMatches = FULL_MODE
    ? null
    : await loadRecentlySyncedMatches();

  const targetPlayerIds = FULL_MODE
    ? null
    : collectPlayerIds(recentMatches);

  if (!FULL_MODE && targetPlayerIds.size === 0) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "incremental",
          recentMatches: recentMatches.length,
          targetPlayers: 0,
          updatedPlayers: 0,
        },
        null,
        2
      )
    );
    return;
  }

  const matches = await loadAllFinishedMatches();
  const players = new Map();

  for (const match of matches) {
    const seenInMatch = new Set();

    for (const player of extractPlayers(
      match.player_stats
    )) {
      if (
        targetPlayerIds &&
        !targetPlayerIds.has(player.playerId)
      ) {
        continue;
      }

      if (seenInMatch.has(player.playerId)) {
        continue;
      }

      seenInMatch.add(player.playerId);

      const rating =
        calculatePlayerMatchRating(player);

      const current =
        players.get(player.playerId) || {
          playerId: player.playerId,
          nickname: player.nickname,
          ratings: [],
          kills: 0,
          deaths: 0,
          assists: 0,
          adrTotal: 0,
          matchesPlayed: 0,
          lastMatchAt: null,
        };

      current.nickname =
        player.nickname ||
        current.nickname;

      current.ratings.push({
        rating,
        finishedAt:
          match.finished_at || null,
      });

      current.kills +=
        Number(player.kills || 0);

      current.deaths +=
        Number(player.deaths || 0);

      current.assists +=
        Number(player.assists || 0);

      current.adrTotal +=
        Number(player.adr || 0);

      current.matchesPlayed += 1;

      if (
        match.finished_at &&
        (
          !current.lastMatchAt ||
          match.finished_at >
            current.lastMatchAt
        )
      ) {
        current.lastMatchAt =
          match.finished_at;
      }

      players.set(
        player.playerId,
        current
      );
    }
  }

  const now =
    new Date().toISOString();

  const rows = [];

  for (const player of players.values()) {
    if (
      player.matchesPlayed <
      MIN_MATCHES
    ) {
      continue;
    }

    const ordered =
      [...player.ratings].sort(
        (first, second) =>
          String(first.finishedAt || "")
            .localeCompare(
              String(second.finishedAt || "")
            )
      );

    const allRatings =
      ordered.map(
        (item) => item.rating
      );

    const recentRatings =
      ordered
        .slice(-RECENT_MATCH_COUNT)
        .map(
          (item) => item.rating
        );

    const deaths =
      player.deaths;

    rows.push({
      player_id:
        player.playerId,

      nickname:
        player.nickname,

      rating:
        Number(
          average(allRatings).toFixed(2)
        ),

      recent_rating:
        Number(
          average(recentRatings).toFixed(2)
        ),

      matches_played:
        player.matchesPlayed,

      maps_played:
        player.matchesPlayed,

      kills:
        player.kills,

      deaths,

      assists:
        player.assists,

      adr:
        Number(
          (
            player.adrTotal /
            player.matchesPlayed
          ).toFixed(2)
        ),

      kd:
        Number(
          (
            deaths > 0
              ? player.kills / deaths
              : player.kills
          ).toFixed(3)
        ),

      last_match_at:
        player.lastMatchAt,

      updated_at:
        now,
    });
  }

  rows.sort(
    (first, second) =>
      Number(second.rating) -
      Number(first.rating)
  );

  for (
    let index = 0;
    index < rows.length;
    index += WRITE_BATCH_SIZE
  ) {
    const batch = rows.slice(
      index,
      index + WRITE_BATCH_SIZE
    );

    const { error } = await supabase
      .from("player_ratings")
      .upsert(batch, {
        onConflict: "player_id",
      });

    if (error) {
      throw new Error(
        `Unable to save player ratings: ${error.message}`
      );
    }

    console.log(
      `Player ratings: ${Math.min(
        index + batch.length,
        rows.length
      )}/${rows.length}`
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: FULL_MODE ? "full" : "incremental",
        recentMatches: recentMatches?.length ?? matches.length,
        targetPlayers: targetPlayerIds?.size ?? rows.length,
        historicalMatchesScanned: matches.length,
        players: rows.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    "PLAYER RATING RECALCULATION FAILED:",
    error
  );
  process.exitCode = 1;
});
