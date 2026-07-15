import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import teams from "../src/data/teams.js";
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
  "MATCH_STATUS_READY",
  "MATCH_STATUS_ONGOING",
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
  process.env.MATCH_SYNC_CONCURRENCY || 5
);

const MAP_STATS_BATCH_SIZE = Number(
  process.env.MAP_STATS_BATCH_SIZE || 50
);

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
      "Unknown",

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

    kast: statValue(stats, [
      "KAST %",
      "KAST",
      "kast",
    ]),

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
    entries.find((entry) => {
      if (
        Number(entry?.matchRound) !== 0
      ) {
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
    });

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
  payload
) {
  const rounds = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rounds)
      ? payload.rounds
      : [];

  return rounds
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
  const entries = Object.entries(
    data?.teams || {}
  );

  if (entries.length < 2) {
    return null;
  }

  const [firstKey, firstRaw] =
    entries[0];

  const [secondKey, secondRaw] =
    entries[1];

  const first =
    normalizeFaction(firstRaw);

  const second =
    normalizeFaction(secondRaw);

  const firstScore = Number(
    data.results?.score?.[
      firstKey
    ] ??
    firstRaw?.score ??
    0
  );

  const secondScore = Number(
    data.results?.score?.[
      secondKey
    ] ??
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

    winner_id:
      data.results?.winner ||
      (
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

async function fetchJson(
  url,
  options = {},
  attempts = 3
) {
  let lastError;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt += 1
  ) {
    try {
      const response = await fetch(
        url,
        options
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

      if (
        response.status < 500 &&
        response.status !== 429
      ) {
        throw new Error(
          `${response.status} ` +
          `${response.statusText}` +
          details
        );
      }

      lastError = new Error(
        `${response.status} ` +
        `${response.statusText}` +
        details
      );
    } catch (error) {
      lastError = error;
    }

    await sleep(
      400 * attempt
    );
  }

  throw lastError;
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

function changed(
  existing,
  incoming
) {
  if (!existing) {
    return true;
  }

  return COMPARE_FIELDS.some(
    (field) => {
      const before =
        existing[field] ??
        null;

      const after =
        incoming[field] ??
        null;

      return (
        String(before) !==
        String(after)
      );
    }
  );
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

  const changedRows = rows
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
      "id,status,scheduled_at," +
      "team1_score,team2_score," +
      "started_at,finished_at"
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
      } catch (error) {
        failed += 1;

        console.warn(
          `Refresh failed ` +
          `${match.id}: ` +
          error.message
        );
      }
    }
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

async function fetchFinishedMatchStats(
  matchId
) {
  let officialRounds = [];
  let officialError = null;

  const officialUrl =
    `https://open.faceit.com/data/v4/matches/${encodeURIComponent(
      matchId
    )}/stats`;

  try {
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

    officialRounds =
      normalizeOfficialMatchStats(
        officialPayload
      );
  } catch (error) {
    officialError = error;

    console.warn(
      `Official stats unavailable ` +
      `${matchId}: ` +
      error.message
    );
  }

  let internalRounds = [];
  let playerStats = null;

  if (faceitSessionCookie) {
    const internalUrl =
      `https://www.faceit.com/api/stats/v3/matches/${encodeURIComponent(
        matchId
      )}`;

    try {
      const internalPayload =
        await fetchJson(
          internalUrl,
          {
            headers: {
              Accept:
                "application/json",

              Cookie:
                faceitSessionCookie,

              Referer:
                `https://www.faceit.com/en/cs2/room/${encodeURIComponent(
                  matchId
                )}`,

              "User-Agent":
                "Mozilla/5.0 ESEA-Tracker/1.0",

              "X-Requested-With":
                "XMLHttpRequest",
            },
          }
        );

      internalRounds =
        normalizeInternalMatchStats(
          internalPayload
        );

      playerStats =
        normalizeInternalPlayerStats(
          internalPayload,
          matchId
        );
    } catch (error) {
      console.warn(
        `Internal stats unavailable ` +
        `${matchId}: ` +
        error.message
      );
    }
  } else {
    console.warn(
      `FACEIT_SESSION_COOKIE is missing; ` +
      `player stats cannot be loaded ` +
      `for ${matchId}`
    );
  }

  const rounds =
    officialRounds.length > 0
      ? officialRounds
      : internalRounds;

  if (
    !rounds.length &&
    officialError
  ) {
    throw officialError;
  }

  return {
    source:
      officialRounds.length > 0 &&
      playerStats
        ? "data-v4 + stats-v3"
        : officialRounds.length > 0
          ? "data-v4"
          : "stats-v3",

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
      ].join(",")
    )
    .in("status", [
      "FINISHED",
      "MATCH_STATUS_FINISHED",
    ])
    .eq("stats_synced", false)
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
          ? statsResult.playerStats
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

async function main() {
  const started = Date.now();

  let discovery = null;

  if (mode === "full") {
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

  const refresh =
    await refreshActive();

  const matchStats =
    await syncFinishedMapStats();

  console.log(
    JSON.stringify(
      {
        ok: true,

        mode,

        discovery,

        refresh,

        matchStats,

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