import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

const FACEIT_API_KEY =
  process.env.FACEIT_API_KEY;

const PAGE_SIZE = Math.max(
  100,
  Number(
    process.env.PLAYER_SYNC_PAGE_SIZE ||
      500
  )
);

const REQUEST_DELAY_MS =
  Math.max(
    0,
    Number(
      process.env.PLAYER_SYNC_DELAY_MS ||
        350
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

if (
  !SUPABASE_URL ||
  !SUPABASE_KEY
) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
  );
}

if (!FACEIT_API_KEY) {
  throw new Error(
    "FACEIT_API_KEY is required"
  );
}

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

const sleep = (ms) =>
  new Promise(
    (resolve) =>
      setTimeout(resolve, ms)
  );

function parseJsonValue(
  value,
  fallback = null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  if (
    typeof value !== "string"
  ) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeId(value) {
  const result =
    String(value || "")
      .trim();

  return result || null;
}

function normalizeNickname(value) {
  const result =
    String(value || "")
      .trim();

  if (
    !result ||
    result.toLowerCase() ===
      "unknown"
  ) {
    return null;
  }

  return result;
}

function normalizeStatsPlayer(
  rawPlayer,
  statsTeam = null
) {
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
    normalizeId(
      rawPlayer.playerId ||
      rawPlayer.player_id ||
      rawPlayer.faceit_id ||
      rawPlayer.faceitId ||
      rawPlayer.id ||
      nestedPlayer.player_id ||
      nestedPlayer.playerId ||
      nestedPlayer.faceit_id ||
      nestedPlayer.id
    );

  const nickname =
    normalizeNickname(
      rawPlayer.nickname ||
      rawPlayer.player_name ||
      rawPlayer.playerName ||
      rawPlayer.name ||
      nestedPlayer.nickname ||
      nestedPlayer.player_name ||
      nestedPlayer.name ||
      nestedStats.Nickname ||
      nestedStats.nickname
    );

  const teamId =
    normalizeId(
      rawPlayer.teamId ||
      rawPlayer.team_id ||
      statsTeam?.teamId ||
      statsTeam?.team_id ||
      statsTeam?.id
    );

  const teamName =
    normalizeNickname(
      rawPlayer.teamName ||
      rawPlayer.team_name ||
      statsTeam?.teamName ||
      statsTeam?.team_name ||
      statsTeam?.name
    );

  if (
    !faceitId &&
    !nickname
  ) {
    return null;
  }

  return {
    faceitId,
    nickname,
    teamId,
    teamName,
  };
}

function extractPlayersFromPayload(
  rawPayload
) {
  const payload =
    parseJsonValue(
      rawPayload,
      null
    );

  if (!payload) {
    return [];
  }

  const playersByKey =
    new Map();

  function addPlayer(
    rawPlayer,
    statsTeam = null
  ) {
    const player =
      normalizeStatsPlayer(
        rawPlayer,
        statsTeam
      );

    if (!player) {
      return;
    }

    const key =
      player.faceitId ||
      player.nickname?.toLowerCase();

    if (!key) {
      return;
    }

    const existing =
      playersByKey.get(key);

    playersByKey.set(
      key,
      {
        ...(existing || {}),
        ...player,
        nickname:
          player.nickname ||
          existing?.nickname ||
          null,
        teamId:
          player.teamId ||
          existing?.teamId ||
          null,
        teamName:
          player.teamName ||
          existing?.teamName ||
          null,
      }
    );
  }

  const aggregatePlayers =
    Array.isArray(
      payload.players
    )
      ? payload.players
      : [];

  aggregatePlayers.forEach(
    (player) =>
      addPlayer(player)
  );

  const directTeams =
    Array.isArray(
      payload.teams
    )
      ? payload.teams
      : [];

  directTeams.forEach(
    (team) => {
      const players =
        Array.isArray(
          team.players
        )
          ? team.players
          : [];

      players.forEach(
        (player) =>
          addPlayer(
            player,
            team
          )
      );
    }
  );

  const maps =
    Array.isArray(
      payload.maps
    )
      ? payload.maps
      : [];

  maps.forEach((map) => {
    const teams =
      Array.isArray(
        map?.teams
      )
        ? map.teams
        : [];

    teams.forEach((team) => {
      const players =
        Array.isArray(
          team.players
        )
          ? team.players
          : [];

      players.forEach(
        (player) =>
          addPlayer(
            player,
            team
          )
      );
    });
  });

  return [
    ...playersByKey.values(),
  ];
}

async function loadMatches() {
  const rows = [];
  let from = 0;
  const cutoff = new Date(
    Date.now() - SINCE_HOURS * 60 * 60 * 1000
  ).toISOString();

  while (true) {
    let query = supabase
      .from("matches")
      .select(
        "id,finished_at,stats_synced_at,team1_id,team1_name,team2_id,team2_name,player_stats"
      )
      .not("player_stats", "is", null);

    if (!FULL_MODE) {
      query = query.gte("stats_synced_at", cutoff);
    }

    const { data, error } = await query
      .order("stats_synced_at", {
        ascending: false,
        nullsFirst: false,
      })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const batch = data || [];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchFaceitProfile(
  faceitId
) {
  const response =
    await fetch(
      `https://open.faceit.com/data/v4/players/${encodeURIComponent(
        faceitId
      )}`,
      {
        headers: {
          Authorization:
            `Bearer ${FACEIT_API_KEY}`,
          Accept:
            "application/json",
        },
      }
    );

  if (response.status === 404) {
    return null;
  }

  if (
    response.status === 429
  ) {
    throw new Error(
      "FACEIT Open API rate limit 429"
    );
  }

  if (!response.ok) {
    throw new Error(
      `FACEIT player profile status ${response.status}`
    );
  }

  return response.json();
}

function buildPlayerRow(
  profile,
  fallback
) {
  const cs2 =
    profile?.games?.cs2 ||
    {};

  return {
    faceit_id:
      profile?.player_id ||
      fallback.faceitId,

    nickname:
      profile?.nickname ||
      fallback.nickname ||
      "Unknown",

    avatar:
      profile?.avatar ||
      null,

    country:
      profile?.country
        ? String(
            profile.country
          ).toUpperCase()
        : null,

    steam_id:
      profile?.steam_id_64 ||
      profile?.steam_nickname ||
      null,

    faceit_elo:
      Number(
        cs2.faceit_elo ||
        0
      ) || null,

    faceit_level:
      Number(
        cs2.skill_level ||
        0
      ) || null,

    updated_at:
      new Date().toISOString(),
  };
}

async function upsertPlayer(
  playerRow
) {
  const {
    data,
    error,
  } = await supabase
    .from("players")
    .upsert(
      playerRow,
      {
        onConflict:
          "faceit_id",
      }
    )
    .select(
      "id,faceit_id,nickname"
    )
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function upsertTeamPlayer(
  teamId,
  playerId
) {
  if (
    !teamId ||
    !playerId
  ) {
    return;
  }

  const {
    error,
  } = await supabase
    .from("team_players")
    .upsert(
      {
        team_id:
          teamId,

        player_id:
          playerId,

        is_active:
          true,

        joined_at:
          new Date().toISOString(),

        left_at:
          null,
      },
      {
        onConflict:
          "team_id,player_id",
      }
    );

  if (error) {
    throw error;
  }
}

async function main() {
  const matches =
    await loadMatches();

  const playersByFaceitId =
    new Map();

  for (const match of matches) {
    const players =
      extractPlayersFromPayload(
        match.player_stats
      );

    for (
      const player
      of players
    ) {
      if (!player.faceitId) {
        continue;
      }

      const existing =
        playersByFaceitId.get(
          player.faceitId
        );

      playersByFaceitId.set(
        player.faceitId,
        {
          ...(existing || {}),
          ...player,
          nickname:
            player.nickname ||
            existing?.nickname ||
            null,
          teamId:
            player.teamId ||
            existing?.teamId ||
            null,
          teamName:
            player.teamName ||
            existing?.teamName ||
            null,
        }
      );
    }
  }

  console.log(
    FULL_MODE
      ? "Player sync mode: FULL"
      : `Player sync mode: INCREMENTAL (${SINCE_HOURS}h lookback)`
  );

  console.log(
    `Matches with stats: ${matches.length}`
  );

  console.log(
    `Unique FACEIT players: ${playersByFaceitId.size}`
  );

  let synced = 0;
  let skipped = 0;
  let failed = 0;
  let index = 0;

  for (
    const player
    of playersByFaceitId.values()
  ) {
    index += 1;

    try {
      const profile =
        await fetchFaceitProfile(
          player.faceitId
        );

      if (!profile) {
        skipped += 1;

        console.log(
          `SKIP 404 ${player.faceitId} (${index}/${playersByFaceitId.size})`
        );

        continue;
      }

      const row =
        buildPlayerRow(
          profile,
          player
        );

      const savedPlayer =
        await upsertPlayer(
          row
        );

      await upsertTeamPlayer(
        player.teamId,
        savedPlayer.id
      );

      synced += 1;

      console.log(
        `SAVED ${row.nickname} | ELO ${row.faceit_elo || "—"} | LVL ${row.faceit_level || "—"} (${index}/${playersByFaceitId.size})`
      );

      await sleep(
        REQUEST_DELAY_MS
      );
    } catch (error) {
      failed += 1;

      console.error(
        `ERROR ${player.faceitId}: ${error.message}`
      );

      /*
       * При 429 не ждём по несколько минут:
       * завершаем текущий запуск, чтобы
       * продолжить позже.
       */
      if (
        String(
          error.message
        ).includes("429")
      ) {
        console.error(
          "FACEIT rate limit reached. Run the script again later."
        );

        break;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        matches:
          matches.length,

        discoveredPlayers:
          playersByFaceitId.size,

        synced,
        skipped,
        failed,
      },
      null,
      2
    )
  );
}

main().catch(
  (error) => {
    console.error(
      "FATAL:",
      error
    );

    process.exitCode = 1;
  }
);
