import { tx, translateError, translateBackLabel, tf } from "../i18n/translate.js";
import { currentLocale } from "../i18n/languages.js";
import { useTeamCatalog } from "../hooks/useTeamCatalog";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import matchStatsCompact from "../data/matchStatsCompact.json";
import teams from "../data/teams";
import players from "../data/players";
import playerTransfers from "../data/playerTransfers.json";
import playerAverageRatings from "../data/playerAverageRatings.json";
import playerAliases from "../data/playerAliases";
import matchesData from "../data/matches.js";

import { normalizeNickname } from "../utils/normalizeNickname";
import { calculatePlayerMatchRating } from "../utils/calculatePlayerRating";
import { supabase } from "../lib/supabaseClient";
import TournamentNameLink from "../components/TournamentNameLink";
import {
  getPlayerSeoMetadata,
  isFaceitPlayerId,
} from "../utils/playerSeo";


const MATCH_PAGE_SIZE = 500;
const RECENT_MATCH_LIMIT = 10;

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
  if (value == null || value === "") return fallback;
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
    currentLocale(),
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
        {tx(label)}
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
          {tx(hint)}
        </div>
      )}
    </div>
  );
}

function PlayerPage() {
  const { teams } = useTeamCatalog();
  const {
    playerId,
    nickname,
  } = useParams();

  const routePlayerKey =
    playerId || nickname || "";

  const location =
    useLocation();
  const navigate = useNavigate();

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
    (
      isFaceitPlayerId(decodedRouteValue)
        ? ""
        : decodedRouteValue
    );

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
    teams.find((team) => team.activeSeasonParticipant !== false &&
      team.playerIds?.includes(resolvedPlayerId)) ||
    teams.find((team) => team.activeSeasonParticipant !== false &&
      team.players?.some((player) => normalizePlayerName(player) === normalizePlayerName(decodedNickname))) ||
    teams.find((team) => team.players?.some((player) => normalizePlayerName(player) === normalizePlayerName(decodedNickname))) || null;

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
    let running = false;

    async function loadPlayerData() {
      if (running) return;
      running = true;
      setLoadingStats(true);
      setStatsError("");

      try {
        if (!supabase) {
          throw new Error(
            tx("Supabase client is not configured")
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
          const normalizedRequestedNickname = decodedRouteValue.toLowerCase();
          const aliasEntry = Object.entries(playerAliases).find(
            ([canonicalNickname, aliases]) =>
              canonicalNickname.toLowerCase() === normalizedRequestedNickname ||
              aliases.some(
                (alias) => String(alias).toLowerCase() === normalizedRequestedNickname
              )
          );
          const lookupNickname = aliasEntry?.[0] || decodedRouteValue;
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
              lookupNickname
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
          let identityQuery = supabase.from("players")
            .select("id,faceit_id,nickname,avatar,country,faceit_elo,faceit_level");
          identityQuery = isFaceitPlayerId(playerIdFromRating)
            ? identityQuery.eq("faceit_id", playerIdFromRating)
            : identityQuery.ilike("nickname", decodedRouteValue).limit(1);
          const { data, error } = await identityQuery
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

        const matchRows = [];
        if (isFaceitPlayerId(playerRow?.faceit_id || playerIdFromRating)) {
          for (let from = 0; ; from += MATCH_PAGE_SIZE) {
            const { data, error } = await supabase
              .rpc("get_player_match_history", {
                p_player_id: playerRow?.faceit_id || playerIdFromRating,
              })
              .range(from, from + MATCH_PAGE_SIZE - 1);
            if (error) throw error;
            if (cancelled) return;
            matchRows.push(...(data || []));
            if (!data || data.length < MATCH_PAGE_SIZE) break;
          }
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
            (
              isFaceitPlayerId(decodedRouteValue)
                ? ""
                : decodedRouteValue
            )
          );

          setResolvedPlayerId(
            playerRow?.faceit_id || playerIdFromRating
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
            isFaceitPlayerId(decodedRouteValue)
              ? ""
              : decodedRouteValue
          );
          setResolvedPlayerId(
            routePlayerKey
          );
          setStatsError(
            tx("Automatic statistics are temporarily unavailable")
          );
        }
      } finally {
        running = false;
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    }

    loadPlayerData();
    const refreshTimer = setInterval(() => {
      if (!document.hidden) loadPlayerData();
    }, 60000);

    return () => {
      clearInterval(refreshTimer);
      cancelled = true;
    };
  }, [
    routePlayerKey,
    decodedRouteValue,
  ]);

  useEffect(() => {
    if (
      loadingStats ||
      !isFaceitPlayerId(resolvedPlayerId) ||
      location.pathname.toLowerCase() ===
        `/players/${resolvedPlayerId}`.toLowerCase()
    ) {
      return;
    }

    navigate(`/players/${resolvedPlayerId}`, {
      replace: true,
      state: location.state,
    });
  }, [
    loadingStats,
    location.pathname,
    location.state,
    navigate,
    resolvedPlayerId,
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

  useEffect(() => {
    if (!decodedNickname) return;

    const metadata = getPlayerSeoMetadata(
      {
        playerId: resolvedPlayerId,
        nickname: decodedNickname,
        avatar: databasePlayer?.avatar,
        teamName: currentTeam?.name,
        rating: mapsPlayed ? averageRating : null,
        mapsPlayed,
        adr: mapsPlayed ? avgAdr : null,
        kd: mapsPlayed ? avgKd : null,
      },
      playerAliases
    );
    window.dispatchEvent(
      new CustomEvent("player-seo-update", {
        detail: {
          ...metadata,
          schema: { "@context":"https://schema.org", "@type":"Person", name:decodedNickname, identifier:resolvedPlayerId, url:metadata.canonicalUrl },
          routePath: metadata.canonicalPath,
        },
      })
    );
  }, [
    averageRating,
    avgAdr,
    avgKd,
    currentTeam?.name,
    databasePlayer?.avatar,
    decodedNickname,
    mapsPlayed,
    resolvedPlayerId,
  ]);

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

  const recentWinRate = recentForm.length
    ? recentForm.filter((match) => match.won).length / recentForm.length * 100
    : 0;

  const performanceStats = [
    {
      label: "ADR",
      value:
        toNumber(avgAdr).toFixed(1),
      caption:
        tx("Average damage per round"),
    },
    {
      label: "K/D",
      value:
        toNumber(avgKd).toFixed(2),
      caption:
        tx("Kill/death ratio"),
    },
    {
      label: tx("Kills"),
      value:
        toNumber(avgKills).toFixed(1),
      caption:
        tx("Average per match"),
    },
    {
      label: tx("Deaths"),
      value:
        toNumber(avgDeaths).toFixed(1),
      caption:
        tx("Average per match"),
    },
    {
      label: tx("Assists"),
      value:
        toNumber(avgAssists).toFixed(1),
      caption:
        tx("Average per match"),
    },
    {
      label: "HS%",
      value:
        `${toNumber(avgHs).toFixed(1)}%`,
      caption:
        tx("Headshot percentage"),
    },
  ];

  return (
    <div className="min-h-screen bg-[#090f16] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <Link
          to={backLink}
          className="inline-flex items-center text-sm font-medium text-slate-400 transition hover:text-orange-300"
        >
          {translateBackLabel(backLabel)}
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
      <div className="text-xs uppercase tracking-wider text-slate-500">{tx(" Current team ")}</div>

      <div className="font-bold text-white">
        {currentTeam.name}
      </div>
    </div>
  </Link>
) : (
  <div className="rounded-2xl border border-[#2a3749] bg-[#0d151f] px-4 py-3">
    <div className="text-xs uppercase tracking-wider text-slate-500">{tx(" Current team ")}</div>

    <div className="font-bold text-slate-400">{tx(" Free agent ")}</div>
  </div>
)}
              </div>

              <div className="mt-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{tx(" Recent form ")}</div>

                    <div className="mt-1 text-sm text-slate-400">{tx(" Last ")}{recentForm.length}{tx(" matches ")}</div>
                  </div>

                  <div className="text-sm font-bold text-slate-300">
                    {recentWinRate.toFixed(0)}{tx("% wins ")}</div>
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
                            ? tx("W")
                            : tx("L")}
                        </Link>
                      )
                    )
                  ) : (
                    <div className="text-sm text-slate-600">{tx(" No recent matches ")}</div>
                  )}
                </div>
              </div>

              {loadingStats && (
                <div className="mt-5 text-sm text-slate-500">{tx(" Loading player statistics... ")}</div>
              )}

              {statsError && (
                <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                  {translateError(statsError)}{tx(". Saved local data is shown. ")}</div>
              )}
            </div>

            <div className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className={`rounded-3xl border p-6 ${ratingBackground(averageRating)}`}>
                <div className="text-xs font-semibold uppercase tracking-[0.17em] text-slate-400">{tx(" Player rating ")}</div>

                <div className={`mt-3 text-6xl font-black tracking-tight ${ratingColor(averageRating)}`}>
                  {averageRating
                    ? averageRating.toFixed(2)
                    : "—"}
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{tx(" Recent ")}</span>

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
                    Number(databasePlayer?.faceit_elo) > 0
                      ? databasePlayer.faceit_elo
                      : databasePlayer ? "—" : (localPlayerInfo?.elo || "—")
                  }
                  accent
                />

                <StatCard
                  label={tx("Matches")}
                  value={
                    matchesPlayed ||
                    "—"
                  }
                  hint={tf("{0} maps", mapsPlayed || 0)}
                />
              </div>

              <div className="rounded-2xl border border-[#263244] bg-[#0f1620] p-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{tx(" Last update ")}</div>

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
              <h2 className="text-2xl font-black">{tx(" Performance ")}</h2>

              <p className="mt-1 text-sm text-slate-500">{tx(" Career averages from recorded matches ")}</p>
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
                <h2 className="text-xl font-black">{tx(" Recent matches ")}</h2>

                <div className="mt-1 text-sm text-slate-500">{tx(" Individual performance in the latest games ")}</div>
              </div>

              <div className="text-sm font-bold text-slate-500">
                {totalMatches}{tx(" total ")}</div>
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
                            {match.opponent?.teamName || tx("Unknown")}
                          </div>

                          <div className="mt-1 truncate text-xs text-slate-500">
                            <TournamentNameLink name={match.season} />
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
                          <div className="text-xs uppercase tracking-wider text-slate-600">{tx(" Rating ")}</div>

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
              <div className="px-6 py-16 text-center text-slate-600">{tx(" No match statistics found ")}</div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-[24px] border border-[#263244] bg-[#101722] p-6">
              <h2 className="text-xl font-black">{tx(" Overview ")}</h2>

              <div className="mt-5 space-y-4">
                {[
                  [
                    tx("Matches"),
                    matchesPlayed,
                  ],
                  [
                    tx("Maps"),
                    mapsPlayed,
                  ],
                  [
                    tx("Wins"),
                    wins,
                  ],
                  [
                    tx("Win rate"),
                    `${winRate.toFixed(1)}%`,
                  ],
                  [
                    tx("Total kills"),
                    databaseRating?.kills ?? "—",
                  ],
                  [
                    tx("Total deaths"),
                    databaseRating?.deaths ?? "—",
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={tx(label)}
                      className="flex items-center justify-between border-b border-[#263244] pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-sm text-slate-500">
                        {tx(label)}
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
                <h2 className="text-xl font-black">{tx(" Team history ")}</h2>

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
