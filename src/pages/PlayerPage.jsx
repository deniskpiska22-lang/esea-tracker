import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useParams,
} from "react-router-dom";

import matchStatsCompact from "../data/matchStatsCompact.json";
import teams from "../data/teams";
import players from "../data/players";
import playerTransfers from "../data/playerTransfers.json";
import playerAverageRatings from "../data/playerAverageRatings.json";
import matchesData from "../data/matches.js";

import { normalizeNickname } from "../utils/normalizeNickname";
import { calculatePlayerMatchRating } from "../utils/calculatePlayerRating";
import { supabase } from "../lib/supabaseClient";


const FINISHED_STATUSES = [
  "FINISHED",
  "MATCH_STATUS_FINISHED",
];

const MATCH_LIMIT = 1000;
const RECENT_MATCH_LIMIT = 10;

function isFaceitPlayerId(value) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(
    String(value || "").trim()
  );
}

function normalizeName(value = "") {
  return String(value || "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizePlayerName(value = "") {
  return String(
    normalizeNickname(value)
  ).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function parseJsonValue(value, fallback) {
  if (
    value === null ||
    value === undefined
  ) {
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

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function ratingColor(value) {
  const rating =
    toNumber(value);

  if (rating >= 1.2) {
    return "text-emerald-400";
  }

  if (rating >= 1.05) {
    return "text-lime-300";
  }

  if (rating >= 0.9) {
    return "text-amber-300";
  }

  return "text-rose-400";
}

function ratingBackground(value) {
  const rating =
    toNumber(value);

  if (rating >= 1.2) {
    return "border-emerald-500/25 bg-emerald-500/10";
  }

  if (rating >= 1.05) {
    return "border-lime-500/20 bg-lime-500/10";
  }

  if (rating >= 0.9) {
    return "border-amber-500/20 bg-amber-500/10";
  }

  return "border-rose-500/20 bg-rose-500/10";
}

function findLocalTeam(
  faceitTeamId,
  teamName
) {
  return (
    teams.find(
      (team) =>
        faceitTeamId &&
        team.faceitTeamId ===
          faceitTeamId
    ) ||
    teams.find(
      (team) =>
        teamName &&
        normalizeName(team.name) ===
          normalizeName(teamName)
    ) ||
    null
  );
}

function findSiteMatch(
  matchId,
  teamName
) {
  return (
    matchesData.find(
      (match) =>
        match.matchId === matchId &&
        normalizeName(match.teamName) ===
          normalizeName(teamName)
    ) ||
    matchesData.find(
      (match) =>
        match.matchId === matchId
    ) ||
    null
  );
}

function normalizeMatchPlayer(player = {}) {
  return {
    ...player,

    kills:
      toNumber(player.kills),

    deaths:
      toNumber(player.deaths),

    assists:
      toNumber(player.assists),

    adr:
      toNumber(player.adr),

    kd:
      toNumber(
        player.kd,
        toNumber(player.deaths) > 0
          ? toNumber(player.kills) /
            toNumber(player.deaths)
          : toNumber(player.kills)
      ),

    hsRate:
      toNumber(
        player.hsRate ??
        player.hs_rate ??
        player.hs
      ),

    kast:
      toNumber(player.kast),

    mvps:
      toNumber(player.mvps),
  };
}

function buildSupabasePlayerMatches(
  rows,
  decodedNickname,
  targetPlayerId
) {
  const normalizedTarget =
    normalizePlayerName(
      decodedNickname
    );

  const normalizedPlayerId =
    String(
      targetPlayerId || ""
    ).toLowerCase();

  return rows.flatMap((row) => {
    const playerStats =
      parseJsonValue(
        row.player_stats,
        null
      );

    const mapScores =
      parseJsonValue(
        row.map_scores,
        []
      );

    if (
      !playerStats ||
      !Array.isArray(
        playerStats.teams
      )
    ) {
      return [];
    }

    const playerTeam =
      playerStats.teams.find(
        (team) =>
          Array.isArray(
            team.players
          ) &&
          team.players.some(
            (player) => {
              const candidateId =
                String(
                  player.playerId ||
                  player.player_id ||
                  player.faceit_id ||
                  player.faceitId ||
                  player.id ||
                  ""
                ).toLowerCase();

              return (
                (
                  normalizedPlayerId &&
                  candidateId ===
                    normalizedPlayerId
                ) ||
                normalizePlayerName(
                  player.nickname
                ) ===
                  normalizedTarget
              );
            }
          )
      );

    if (!playerTeam) {
      return [];
    }

    

    const rawPlayer =
      playerTeam.players.find(
        (item) => {
          const candidateId =
            String(
              item.playerId ||
              item.player_id ||
              item.faceit_id ||
              item.faceitId ||
              item.id ||
              ""
            ).toLowerCase();

          return (
            (
              normalizedPlayerId &&
              candidateId ===
                normalizedPlayerId
            ) ||
            normalizePlayerName(
              item.nickname
            ) ===
              normalizedTarget
          );
        }
      );

    if (!rawPlayer) {
      return [];
    }

    const player =
      normalizeMatchPlayer(
        rawPlayer
      );

    const opponent =
      playerStats.teams.find(
        (team) =>
          team.teamId !==
            playerTeam.teamId ||
          normalizeName(
            team.teamName
          ) !==
            normalizeName(
              playerTeam.teamName
            )
      );

    const teamIsFirst =
      Boolean(
        playerTeam.teamId &&
        row.team1_id ===
          playerTeam.teamId
      ) ||
      normalizeName(
        playerTeam.teamName
      ) ===
        normalizeName(
          row.team1_name
        );

    const teamId = teamIsFirst
      ? row.team1_id
      : row.team2_id;

    const teamName = teamIsFirst
      ? row.team1_name
      : row.team2_name;

    const teamScore = toNumber(
      teamIsFirst
        ? row.team1_score
        : row.team2_score,
      toNumber(playerTeam.score)
    );

    const opponentScore =
      toNumber(
        teamIsFirst
          ? row.team2_score
          : row.team1_score,
        toNumber(opponent?.score)
      );

    const opponentName =
      teamIsFirst
        ? row.team2_name
        : row.team1_name;

    const localTeam =
      findLocalTeam(
        teamId,
        teamName ||
          playerTeam.teamName
      );

    const siteMatch =
      findSiteMatch(
        row.id,
        teamName ||
          playerTeam.teamName
      );

    const maps =
      Array.isArray(mapScores)
        ? mapScores
            .map(
              (map) =>
                map?.map
            )
            .filter(Boolean)
        : [];

    const rating =
      calculatePlayerMatchRating(
        player
      );

    return [
      {
        ...player,

        matchId: row.id,

        teamId,

        teamName:
          teamName ||
          playerTeam.teamName ||
          "Unknown",

        teamSlug:
          localTeam?.slug ||
          siteMatch?.teamSlug ||
          null,

        teamScore,

        opponent: {
          teamId:
            opponent?.teamId ||
            (
              teamIsFirst
                ? row.team2_id
                : row.team1_id
            ) ||
            null,

          teamName:
            opponentName ||
            opponent?.teamName ||
            "Unknown",

          score:
            opponentScore,
        },

        map:
          playerStats.map ||
          maps[0] ||
          "Unknown",

        maps,

        date:
          row.finished_at ||
          row.scheduled_at ||
          null,

        season:
          row.competition_name ||
          "ESEA League",

        won:
          teamScore >
          opponentScore,

        rating,

        source:
          "supabase",
      },
    ];
  });
}

function buildFallbackPlayerMatches(
  decodedNickname
) {
  return Object.values(
    matchStatsCompact
  ).flatMap((match) =>
    (
      Array.isArray(match.teams)
        ? match.teams
        : []
    ).flatMap((team) =>
      (
        Array.isArray(team.players)
          ? team.players
          : []
      )
        .filter(
          (player) =>
            normalizePlayerName(
              player.nickname
            ) ===
            normalizePlayerName(
              decodedNickname
            )
        )
        .map((rawPlayer) => {
          const player =
            normalizeMatchPlayer(
              rawPlayer
            );

          const siteMatch =
            findSiteMatch(
              match.matchId,
              team.teamName
            );

          const opponent =
            match.teams.find(
              (item) =>
                item.teamId !==
                team.teamId
            );

          const teamScore =
            toNumber(team.score);

          const opponentScore =
            toNumber(
              opponent?.score
            );

          return {
            ...player,

            matchId:
              match.matchId,

            teamId:
              team.teamId ||
              null,

            teamName:
              team.teamName ||
              "Unknown",

            teamSlug:
              siteMatch?.teamSlug ||
              null,

            teamScore,

            opponent: {
              teamId:
                opponent?.teamId ||
                null,

              teamName:
                opponent?.teamName ||
                "Unknown",

              score:
                opponentScore,
            },

            map:
              match.map ||
              siteMatch?.maps?.[0] ||
              "Unknown",

            maps:
              siteMatch?.maps ||
              [],

            date:
              siteMatch?.date ||
              null,

            season:
              siteMatch?.season ||
              "ESEA League",

            won:
              teamScore >
              opponentScore,

            rating:
              calculatePlayerMatchRating(
                player
              ),

            source:
              "fallback",
          };
        })
    )
  );
}

function StatCard({
  label,
  value,
  hint,
  accent = false,
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? "border-orange-500/25 bg-orange-500/10"
          : "border-[#263244] bg-[#0f1620]"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>

      <div
        className={`mt-2 text-3xl font-black ${
          accent
            ? "text-orange-300"
            : "text-white"
        }`}
      >
        {value}
      </div>

      {hint && (
        <div className="mt-1 text-xs text-slate-500">
          {hint}
        </div>
      )}
    </div>
  );
}

function PlayerPage() {
  const {
    playerId,
    nickname,
  } = useParams();

  const routePlayerKey =
    playerId || nickname || "";

  const location =
    useLocation();

  const decodedRouteValue =
    String(
      normalizeNickname(
        decodeURIComponent(
          routePlayerKey
        )
      )
    );

  const [resolvedNickname, setResolvedNickname] =
    useState("");

  const decodedNickname =
    resolvedNickname ||
    decodedRouteValue;

  const [databaseMatches, setDatabaseMatches] =
    useState([]);

  const [databaseRating, setDatabaseRating] =
    useState(null);

  const [databasePlayer, setDatabasePlayer] =
    useState(null);

  const [resolvedPlayerId, setResolvedPlayerId] =
    useState(routePlayerKey);

  const [loadingStats, setLoadingStats] =
    useState(true);

  const [statsError, setStatsError] =
    useState("");

  const playerTeam =
    teams.find((team) =>
      team.players?.some(
        (player) =>
          normalizePlayerName(
            player
          ) ===
          normalizePlayerName(
            decodedNickname
          )
      )
    ) || null;

  const backLink =
    location.state?.from ||
    (
      playerTeam?.slug
        ? `/teams/${playerTeam.slug}`
        : "/"
    );

  const backLabel =
    location.state?.label ||
    (
      playerTeam?.name
        ? `← Back to ${playerTeam.name}`
        : "← Back"
    );

  const localPlayerInfo =
    Object.values(players)
      .flat()
      .find(
        (player) =>
          normalizePlayerName(
            player.nickname
          ) ===
          normalizePlayerName(
            decodedNickname
          )
      ) || null;

  const transfers =
    playerTransfers[
      decodedNickname
    ] || [];

  /*
   * PlayerPage и TeamPage используют
   * одну и ту же запись players.avatar.
   * Локальные картинки по нику больше
   * не участвуют в выборе изображения.
   */
  const identityPlayer =
    databasePlayer ||
    localPlayerInfo ||
    {
      faceit_id:
        resolvedPlayerId,
      nickname:
        decodedNickname,
      avatar: null,
    };

  /*
   * В FACEIT URL нельзя подставлять UUID.
   * Сначала сопоставляем players.faceit_id с players.nickname,
   * затем строим ссылку только из nickname.
   */
  const faceitProfileNickname =
    String(
      databasePlayer?.nickname ||
      databaseRating?.nickname ||
      (
        !isFaceitPlayerId(routePlayerKey)
          ? decodedNickname
          : ""
      )
    ).trim();

  const faceitProfileUrl =
    faceitProfileNickname
      ? `https://www.faceit.com/en/players/${encodeURIComponent(
          faceitProfileNickname
        )}`
      : null;

  useEffect(() => {
    let cancelled = false;

    async function loadPlayerData() {
      setLoadingStats(true);
      setStatsError("");

      try {
        if (!supabase) {
          throw new Error(
            "Supabase client is not configured"
          );
        }

        let ratingRow = null;

        const looksLikePlayerId =
          isFaceitPlayerId(
            routePlayerKey
          );

        if (looksLikePlayerId) {
          const {
            data,
            error,
          } = await supabase
            .from("player_ratings")
            .select(
              [
                "player_id",
                "nickname",
                "rating",
                "recent_rating",
                "matches_played",
                "maps_played",
                "kills",
                "deaths",
                "assists",
                "adr",
                "kd",
                "last_match_at",
              ].join(",")
            )
            .eq(
              "player_id",
              routePlayerKey
            )
            .maybeSingle();

          if (
            error &&
            error.code !== "PGRST116"
          ) {
            throw error;
          }

          ratingRow = data || null;
        } else {
          const {
            data,
            error,
          } = await supabase
            .from("player_ratings")
            .select(
              [
                "player_id",
                "nickname",
                "rating",
                "recent_rating",
                "matches_played",
                "maps_played",
                "kills",
                "deaths",
                "assists",
                "adr",
                "kd",
                "last_match_at",
              ].join(",")
            )
            .ilike(
              "nickname",
              decodedRouteValue
            )
            .limit(1)
            .maybeSingle();

          if (
            error &&
            error.code !== "PGRST116"
          ) {
            throw error;
          }

          ratingRow = data || null;
        }

        const playerIdFromRating =
          String(
            ratingRow?.player_id ||
            routePlayerKey
          );

        let playerRow = null;

        if (playerIdFromRating) {
          const {
            data,
            error,
          } = await supabase
            .from("players")
            .select(
              "id,faceit_id,nickname,avatar,country,faceit_elo,faceit_level"
            )
            .eq(
              "faceit_id",
              playerIdFromRating
            )
            .maybeSingle();

          if (
            error &&
            error.code !== "PGRST116"
          ) {
            console.warn(
              "Player identity unavailable:",
              error.message
            );
          }

          playerRow = data || null;
        }

        /*
         * Жёсткое сопоставление:
         * players.faceit_id -> players.nickname.
         * Для FACEIT-ссылки и заголовка используем именно nickname,
         * а UUID оставляем только для запросов в базу.
         */
        const resolvedProfileNickname =
          String(
            playerRow?.nickname ||
            ratingRow?.nickname ||
            (
              isFaceitPlayerId(routePlayerKey)
                ? ""
                : decodedRouteValue
            )
          ).trim();

        const {
          data: matchRows,
          error: matchesError,
        } = await supabase
          .from("matches")
          .select(
            [
              "id",
              "competition_name",
              "status",
              "scheduled_at",
              "finished_at",
              "team1_id",
              "team1_name",
              "team1_score",
              "team2_id",
              "team2_name",
              "team2_score",
              "map_scores",
              "player_stats",
              "stats_synced",
            ].join(",")
          )
          .in(
            "status",
            FINISHED_STATUSES
          )
          .not(
            "player_stats",
            "is",
            null
          )
          .order(
            "finished_at",
            {
              ascending: false,
              nullsFirst: false,
            }
          )
          .limit(MATCH_LIMIT);

        if (matchesError) {
          throw matchesError;
        }

        if (!cancelled) {
          setDatabaseMatches(
            matchRows || []
          );

          setDatabaseRating(
            ratingRow
          );

          setDatabasePlayer(
            playerRow
          );
          

          setResolvedNickname(
            resolvedProfileNickname ||
            decodedRouteValue
          );

          setResolvedPlayerId(
            playerIdFromRating
          );
        }
      } catch (error) {
        console.error(
          "Failed to load player page:",
          error
        );

        if (!cancelled) {
          setDatabaseMatches([]);
          setDatabaseRating(null);
          setDatabasePlayer(null);
          setResolvedNickname(
            decodedRouteValue
          );
          setResolvedPlayerId(
            routePlayerKey
          );
          setStatsError(
            "Automatic statistics are temporarily unavailable"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    }

    loadPlayerData();

    return () => {
      cancelled = true;
    };
  }, [
    routePlayerKey,
    decodedRouteValue,
  ]);

  const supabasePlayerMatches =
    useMemo(
      () =>
        buildSupabasePlayerMatches(
          databaseMatches,
          decodedNickname,
          resolvedPlayerId
        ),
      [
        databaseMatches,
        decodedNickname,
        resolvedPlayerId,
      ]
    );

  const fallbackPlayerMatches =
    useMemo(
      () =>
        buildFallbackPlayerMatches(
          decodedNickname
        ),
      [decodedNickname]
    );

  const playerMatches =
  useMemo(() => {
    const combined =
      new Map();

    fallbackPlayerMatches.forEach(
      (match) => {
        combined.set(
          match.matchId,
          match
        );
      }
    );

    supabasePlayerMatches.forEach(
      (match) => {
        combined.set(
          match.matchId,
          match
        );
      }
    );

    return [
      ...combined.values(),
    ].sort(
      (first, second) =>
        new Date(
          second.date || 0
        ).getTime() -
        new Date(
          first.date || 0
        ).getTime()
    );
  }, [
    fallbackPlayerMatches,
    supabasePlayerMatches,
  ]);

const currentTeam =
  useMemo(() => {
    const latestMatch =
      playerMatches[0];

    if (!latestMatch) {
      return playerTeam;
    }

    return (
      findLocalTeam(
        latestMatch.teamId,
        latestMatch.teamName
      ) ||
      playerTeam
    );
  }, [
    playerMatches,
    playerTeam,
  ]);

    

  const totalMatches =
    playerMatches.length;

  const average = (field) => {
    if (!totalMatches) {
      return 0;
    }

    return (
      playerMatches.reduce(
        (sum, match) =>
          sum +
          toNumber(
            match[field]
          ),
        0
      ) /
      totalMatches
    );
  };

  const avgKills =
    average("kills");

  const avgDeaths =
    average("deaths");

  const avgAssists =
    average("assists");

  const avgAdr =
    databaseRating?.adr ??
    average("adr");

  const avgKd =
    databaseRating?.kd ??
    average("kd");

  const avgHs =
    average("hsRate");

  const calculatedAverageRating =
    totalMatches
      ? playerMatches.reduce(
          (sum, match) =>
            sum +
            toNumber(
              match.rating
            ),
          0
        ) /
        totalMatches
      : 0;

  const averageRating =
    toNumber(
      databaseRating?.rating,
      calculatedAverageRating ||
        playerAverageRatings[
          decodedNickname
        ] ||
        0
    );

  const recentRating =
    toNumber(
      databaseRating?.recent_rating,
      playerMatches.length
        ? playerMatches
            .slice(
              0,
              RECENT_MATCH_LIMIT
            )
            .reduce(
              (sum, match) =>
                sum +
                toNumber(
                  match.rating
                ),
              0
            ) /
            Math.min(
              playerMatches.length,
              RECENT_MATCH_LIMIT
            )
        : averageRating
    );

  const matchesPlayed =
    toNumber(
      databaseRating?.matches_played,
      totalMatches
    );

  const mapsPlayed =
    toNumber(
      databaseRating?.maps_played,
      totalMatches
    );

  const wins =
    playerMatches.filter(
      (match) => match.won
    ).length;

  const winRate =
    totalMatches > 0
      ? (wins / totalMatches) * 100
      : 0;

  const recentForm =
    playerMatches.slice(
      0,
      RECENT_MATCH_LIMIT
    );

  const performanceStats = [
    {
      label: "ADR",
      value:
        toNumber(avgAdr).toFixed(1),
      caption:
        "Average damage per round",
    },
    {
      label: "K/D",
      value:
        toNumber(avgKd).toFixed(2),
      caption:
        "Kill/death ratio",
    },
    {
      label: "Kills",
      value:
        toNumber(avgKills).toFixed(1),
      caption:
        "Average per match",
    },
    {
      label: "Deaths",
      value:
        toNumber(avgDeaths).toFixed(1),
      caption:
        "Average per match",
    },
    {
      label: "Assists",
      value:
        toNumber(avgAssists).toFixed(1),
      caption:
        "Average per match",
    },
    {
      label: "HS%",
      value:
        `${toNumber(avgHs).toFixed(1)}%`,
      caption:
        "Headshot percentage",
    },
  ];

  return (
    <div className="min-h-screen bg-[#090f16] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <Link
          to={backLink}
          className="inline-flex items-center text-sm font-medium text-slate-400 transition hover:text-orange-300"
        >
          {backLabel}
        </Link>

        <section className="relative mt-5 overflow-hidden rounded-[28px] border border-[#263244] bg-[#101722]">
          <div className="absolute inset-0">
            <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500/5 blur-3xl" />
          </div>

          <div className="relative grid gap-8 p-5 sm:p-7 lg:grid-cols-[260px_minmax(0,1fr)_310px] lg:p-9">
            <div>
              <div className="relative aspect-square flex items-end justify-center overflow-hidden rounded-[28px]">

    {currentTeam?.logo && (
  <img
    src={currentTeam.logo}
    alt=""
    className="absolute inset-0 h-full w-full object-contain scale-[1.3] opacity-[0.08] grayscale"
  />
)}

    <img
        src="/player-silhouette.png"
        alt=""
        className="
        relative
        h-[92%]
        object-contain
        z-10
        "
    />

</div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {faceitProfileUrl ? (
                  <a
                    href={faceitProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-[#29364a] bg-[#0c141e] px-4 py-3 text-sm font-bold transition hover:border-orange-500/40 hover:bg-[#131d29]"
                  >
                    <img
                      src="/logos/faceit-logo.png"
                      alt=""
                      className="h-5 w-5 object-contain"
                    />
                    FACEIT
                  </a>
                ) : (
                  <div
                    title={
                      loadingStats
                        ? "Loading FACEIT profile..."
                        : "FACEIT nickname not found"
                    }
                    className="flex items-center justify-center gap-2 rounded-xl border border-[#29364a] bg-[#0c141e] px-4 py-3 text-sm font-bold text-slate-600"
                  >
                    <img
                      src="/logos/faceit-logo.png"
                      alt=""
                      className="h-5 w-5 object-contain opacity-40"
                    />
                    FACEIT
                  </div>
                )}

                {localPlayerInfo?.steamUrl ? (
                  <a
                    href={localPlayerInfo.steamUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center rounded-xl border border-[#29364a] bg-[#0c141e] px-4 py-3 text-sm font-bold transition hover:border-sky-500/40 hover:bg-[#131d29]"
                  >
                    STEAM
                  </a>
                ) : (
                  <div className="flex items-center justify-center rounded-xl border border-[#29364a] bg-[#0c141e] px-4 py-3 text-sm font-bold text-slate-600">
                    STEAM
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                {(databasePlayer?.country ||
                  localPlayerInfo?.country) && (
                  <span className="rounded-full border border-[#2a3749] bg-[#0c141e] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {databasePlayer?.country ||
                      localPlayerInfo?.country}
                  </span>
                )}

                {localPlayerInfo?.role && (
                  <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-300">
                    {localPlayerInfo.role}
                  </span>
                )}
              </div>

              <h1 className="mt-4 break-words text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                {decodedNickname}
              </h1>

              {localPlayerInfo?.realName && (
                <div className="mt-2 text-base text-slate-500">
                  {localPlayerInfo.realName}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-4">
                {currentTeam ? (
  <Link
    to={`/teams/${currentTeam.slug}`}
    className="inline-flex items-center gap-3 rounded-2xl border border-[#2a3749] bg-[#0d151f] px-4 py-3 transition hover:border-orange-500/30"
  >
    {currentTeam.logo && (
      <img
        src={currentTeam.logo}
        alt=""
        className="h-10 w-10 object-contain"
      />
    )}

    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500">
        Current team
      </div>

      <div className="font-bold text-white">
        {currentTeam.name}
      </div>
    </div>
  </Link>
) : (
  <div className="rounded-2xl border border-[#2a3749] bg-[#0d151f] px-4 py-3">
    <div className="text-xs uppercase tracking-wider text-slate-500">
      Current team
    </div>

    <div className="font-bold text-slate-400">
      Free agent
    </div>
  </div>
)}
              </div>

              <div className="mt-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Recent form
                    </div>

                    <div className="mt-1 text-sm text-slate-400">
                      Last {recentForm.length} matches
                    </div>
                  </div>

                  <div className="text-sm font-bold text-slate-300">
                    {winRate.toFixed(0)}% wins
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {recentForm.length ? (
                    recentForm.map(
                      (match, index) => (
                        <Link
                          key={`${match.matchId}-${index}`}
                          to={`/match/${match.matchId}`}
                          title={`${match.opponent?.teamName || "Unknown"} · ${match.rating.toFixed(2)}`}
                          className={`flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-xs font-black transition hover:-translate-y-0.5 ${
                            match.won
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                              : "border-rose-500/25 bg-rose-500/10 text-rose-300"
                          }`}
                        >
                          {match.won
                            ? "W"
                            : "L"}
                        </Link>
                      )
                    )
                  ) : (
                    <div className="text-sm text-slate-600">
                      No recent matches
                    </div>
                  )}
                </div>
              </div>

              {loadingStats && (
                <div className="mt-5 text-sm text-slate-500">
                  Loading player statistics...
                </div>
              )}

              {statsError && (
                <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                  {statsError}. Saved local data is shown.
                </div>
              )}
            </div>

            <div className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className={`rounded-3xl border p-6 ${ratingBackground(averageRating)}`}>
                <div className="text-xs font-semibold uppercase tracking-[0.17em] text-slate-400">
                  Player rating
                </div>

                <div className={`mt-3 text-6xl font-black tracking-tight ${ratingColor(averageRating)}`}>
                  {averageRating
                    ? averageRating.toFixed(2)
                    : "—"}
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    Recent
                  </span>

                  <span className={`font-black ${ratingColor(recentRating)}`}>
                    {recentRating
                      ? recentRating.toFixed(2)
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label="FACEIT ELO"
                  value={
                    databasePlayer?.faceit_elo ||
                    localPlayerInfo?.elo ||
                    "—"
                  }
                  accent
                />

                <StatCard
                  label="Matches"
                  value={
                    matchesPlayed ||
                    "—"
                  }
                  hint={`${mapsPlayed || 0} maps`}
                />
              </div>

              <div className="rounded-2xl border border-[#263244] bg-[#0f1620] p-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Last update
                  </div>

                  <div className="text-sm font-semibold text-slate-300">
                    {formatDate(
                      databaseRating?.last_match_at ||
                      playerMatches[0]?.date
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black">
                Performance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Career averages from recorded matches
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {performanceStats.map(
              (stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  hint={stat.caption}
                />
              )
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
          <div className="overflow-hidden rounded-[24px] border border-[#263244] bg-[#101722]">
            <div className="flex items-center justify-between border-b border-[#263244] px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-xl font-black">
                  Recent matches
                </h2>

                <div className="mt-1 text-sm text-slate-500">
                  Individual performance in the latest games
                </div>
              </div>

              <div className="text-sm font-bold text-slate-500">
                {totalMatches} total
              </div>
            </div>

            {playerMatches.length ? (
              <div className="divide-y divide-[#222e3f]">
                {playerMatches
                  .slice(0, 12)
                  .map(
                    (
                      match,
                      index
                    ) => (
                      <Link
                        key={`${match.matchId}-${index}`}
                        to={`/match/${match.matchId}`}
                        className="grid gap-4 px-5 py-4 transition hover:bg-[#141d29] sm:grid-cols-[110px_minmax(0,1fr)_90px_80px_80px] sm:items-center sm:px-6"
                      >
                        <div>
                          <div className="text-sm font-bold text-slate-300">
                            {formatDate(
                              match.date
                            )}
                          </div>

                          <div className="mt-1 text-xs text-slate-600">
                            {match.map}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="truncate font-bold text-white">
                            {match.teamName}
                            <span className={`mx-2 ${
                              match.won
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}>
                              {match.teamScore}
                              :
                              {match.opponent?.score ?? 0}
                            </span>
                            {match.opponent?.teamName || "Unknown"}
                          </div>

                          <div className="mt-1 truncate text-xs text-slate-500">
                            {match.season}
                          </div>
                        </div>

                        <div className="text-sm">
                          <div className="text-xs uppercase tracking-wider text-slate-600">
                            K-D
                          </div>

                          <div className="mt-1 font-black">
                            {match.kills}
                            -
                            {match.deaths}
                          </div>
                        </div>

                        <div className="text-sm">
                          <div className="text-xs uppercase tracking-wider text-slate-600">
                            ADR
                          </div>

                          <div className="mt-1 font-black">
                            {toNumber(
                              match.adr
                            ).toFixed(1)}
                          </div>
                        </div>

                        <div className="sm:text-right">
                          <div className="text-xs uppercase tracking-wider text-slate-600">
                            Rating
                          </div>

                          <div className={`mt-1 text-lg font-black ${ratingColor(match.rating)}`}>
                            {toNumber(
                              match.rating
                            ).toFixed(2)}
                          </div>
                        </div>
                      </Link>
                    )
                  )}
              </div>
            ) : (
              <div className="px-6 py-16 text-center text-slate-600">
                No match statistics found
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-[24px] border border-[#263244] bg-[#101722] p-6">
              <h2 className="text-xl font-black">
                Overview
              </h2>

              <div className="mt-5 space-y-4">
                {[
                  [
                    "Matches",
                    matchesPlayed,
                  ],
                  [
                    "Maps",
                    mapsPlayed,
                  ],
                  [
                    "Wins",
                    wins,
                  ],
                  [
                    "Win rate",
                    `${winRate.toFixed(1)}%`,
                  ],
                  [
                    "Total kills",
                    databaseRating?.kills ?? "—",
                  ],
                  [
                    "Total deaths",
                    databaseRating?.deaths ?? "—",
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between border-b border-[#263244] pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-sm text-slate-500">
                        {label}
                      </span>

                      <span className="font-black text-slate-200">
                        {value}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            {transfers.length > 0 && (
              <div className="rounded-[24px] border border-[#263244] bg-[#101722] p-6">
                <h2 className="text-xl font-black">
                  Team history
                </h2>

                <div className="mt-5 space-y-5">
                  {transfers
                    .slice()
                    .reverse()
                    .map(
                      (
                        transfer,
                        index
                      ) => (
                        <div
                          key={`${transfer.date}-${index}`}
                          className="relative border-l border-[#344258] pl-5"
                        >
                          <div className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-orange-400" />

                          <div className="font-bold text-white">
                            {transfer.from}
                            <span className="mx-2 text-slate-600">
                              →
                            </span>
                            {transfer.to}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {transfer.date}
                          </div>
                        </div>
                      )
                    )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default PlayerPage;
