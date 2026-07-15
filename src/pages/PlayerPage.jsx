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

function buildSupabasePlayerMatches(
  rows,
  decodedNickname
) {
  const normalizedTarget =
    normalizePlayerName(
      decodedNickname
    );

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
            (player) =>
              normalizePlayerName(
                player.nickname
              ) ===
              normalizedTarget
          )
      );

    if (!playerTeam) {
      return [];
    }

    const player =
      playerTeam.players.find(
        (item) =>
          normalizePlayerName(
            item.nickname
          ) ===
          normalizedTarget
      );

    if (!player) {
      return [];
    }

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

    const firstMap =
      Array.isArray(mapScores) &&
      mapScores.length > 0
        ? mapScores[0]?.map
        : null;

    const normalizedPlayer = {
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
        toNumber(player.kd),

      hsRate:
        toNumber(player.hsRate),

      kast:
        toNumber(player.kast),

      mvps:
        toNumber(player.mvps),
    };

    return [
      {
        ...normalizedPlayer,

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
          firstMap ||
          "Unknown",

        maps:
          Array.isArray(mapScores)
            ? mapScores.map(
                (map) =>
                  map.map
              )
            : [],

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

        rating:
          calculatePlayerMatchRating(
            normalizedPlayer,
            teamScore,
            opponentScore
          ),

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
        .map((player) => {
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

          const normalizedPlayer = {
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
              toNumber(player.kd),

            hsRate:
              toNumber(player.hsRate),

            kast:
              toNumber(player.kast),

            mvps:
              toNumber(player.mvps),
          };

          const teamScore =
            toNumber(team.score);

          const opponentScore =
            toNumber(
              opponent?.score
            );

          return {
            ...normalizedPlayer,

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
                normalizedPlayer,
                teamScore,
                opponentScore
              ),

            source:
              "fallback",
          };
        })
    )
  );
}

function PlayerPage() {
  const { nickname } =
    useParams();

  const location =
    useLocation();

  const decodedNickname =
    String(
      normalizeNickname(
        decodeURIComponent(
          nickname
        )
      )
    );

  const [databaseMatches, setDatabaseMatches] =
    useState([]);

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
        ? `/team/${playerTeam.slug}`
        : "/"
    );

  const backLabel =
    location.state?.label ||
    (
      playerTeam?.name
        ? `← Back to ${playerTeam.name}`
        : "← Back"
    );

  const avatarPath =
    `/players/${decodedNickname}.png`;

  const playerInfo =
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
      );

  const transfers =
    playerTransfers[
      decodedNickname
    ] || [];

  useEffect(() => {
    let cancelled = false;

    async function loadPlayerStats() {
      setLoadingStats(true);
      setStatsError("");

      try {
        if (!supabase) {
          throw new Error(
            "Supabase client is not configured"
          );
        }

        const {
          data,
          error,
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
              "team1_slug",
              "team1_score",

              "team2_id",
              "team2_name",
              "team2_slug",
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
          .limit(1000);

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setDatabaseMatches(
            data || []
          );
        }
      } catch (error) {
        console.error(
          "Failed to load player statistics:",
          error
        );

        if (!cancelled) {
          setDatabaseMatches([]);
          setStatsError(
            "Failed to load automatic player statistics"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    }

    loadPlayerStats();

    return () => {
      cancelled = true;
    };
  }, [decodedNickname]);

  const supabasePlayerMatches =
    useMemo(
      () =>
        buildSupabasePlayerMatches(
          databaseMatches,
          decodedNickname
        ),
      [
        databaseMatches,
        decodedNickname,
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

  /*
   * Объединяем Supabase и старый JSON.
   *
   * Если один и тот же матч есть в обоих
   * источниках, оставляем вариант Supabase.
   */
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
        (first, second) => {
          const firstDate =
            new Date(
              first.date || 0
            ).getTime();

          const secondDate =
            new Date(
              second.date || 0
            ).getTime();

          return (
            secondDate -
            firstDate
          );
        }
      );
    }, [
      fallbackPlayerMatches,
      supabasePlayerMatches,
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

  const avgAdr =
    average("adr");

  const avgKd =
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

  /*
   * Новый рассчитанный рейтинг имеет приоритет.
   * Старый playerAverageRatings остаётся fallback.
   */
  const averageRating =
    calculatedAverageRating ||
    playerAverageRatings[
      decodedNickname
    ] ||
    0;

  const recentForm =
    playerMatches
      .slice(0, 10)
      .map((match) => ({
        win:
          Boolean(match.won),

        map:
          match.map,
      }));

  return (
    <div className="min-h-screen bg-[#0b1118] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link
          to={backLink}
          className="text-gray-400 transition hover:text-orange-400"
        >
          {backLabel}
        </Link>

        <div className="mt-6 rounded-3xl border border-[#243041] bg-[#111823] p-8">
          <div className="grid gap-8 lg:grid-cols-[220px_1fr_220px]">

            {/* AVATAR */}

            <div className="flex w-[220px] flex-col gap-4">
              <div className="relative h-[220px] w-[220px] overflow-hidden rounded-3xl border border-[#243041] bg-[#111823]">
                {playerTeam?.logo && (
                  <img
                    src={
                      playerTeam.logo
                    }
                    alt={
                      playerTeam.name
                    }
                    className="absolute inset-0 h-full w-full scale-125 object-contain opacity-20"
                  />
                )}

                <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#111823] via-transparent to-transparent" />

                <img
                  src={avatarPath}
                  alt={
                    decodedNickname
                  }
                  onError={(event) => {
                    event.currentTarget.src =
                      "/player-silhouette.png";
                  }}
                  className="absolute bottom-0 left-1/2 z-20 h-[110%] -translate-x-1/2 object-contain"
                />
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href={`https://www.faceit.com/en/players/${decodedNickname}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="FACEIT"
                  className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#243041] bg-[#0f1623] transition-all duration-200 hover:scale-105 hover:border-orange-500/50 hover:bg-[#151e2b]"
                >
                  <img
                    src="/logos/faceit-logo.png"
                    alt="FACEIT"
                    className="h-8 w-8 object-contain"
                  />
                </a>
              </div>
            </div>

            {/* MAIN INFO */}

            <div>
              <h1 className="text-5xl font-black">
                {decodedNickname}
              </h1>

              <div className="mt-3 text-xl text-gray-400">
                {playerTeam?.name ||
                  "Unknown Team"}
              </div>

              <div className="mt-3 text-sm text-gray-500">
                Last{" "}
                {
                  recentForm.length
                }{" "}
                matches
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {recentForm.map(
                  (game, index) => (
                    <div
                      key={`${game.map}-${index}`}
                      title={
                        game.map
                      }
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold ${
                        game.win
                          ? "border-green-500/30 bg-green-500/20 text-green-400"
                          : "border-red-500/30 bg-red-500/20 text-red-400"
                      }`}
                    >
                      {game.win
                        ? "W"
                        : "L"}
                    </div>
                  )
                )}
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex justify-between border-b border-[#243041] pb-2">
                  <span className="text-gray-400">
                    Matches
                  </span>

                  <span>
                    {totalMatches}
                  </span>
                </div>

                <div className="flex justify-between border-b border-[#243041] pb-2">
                  <span className="text-gray-400">
                    Average ADR
                  </span>

                  <span>
                    {avgAdr.toFixed(
                      1
                    )}
                  </span>
                </div>

                <div className="flex justify-between border-b border-[#243041] pb-2">
                  <span className="text-gray-400">
                    Average K/D
                  </span>

                  <span>
                    {avgKd.toFixed(
                      2
                    )}
                  </span>
                </div>
              </div>

              {loadingStats && (
                <div className="mt-4 text-sm text-gray-500">
                  Loading automatic
                  statistics...
                </div>
              )}

              {statsError && (
                <div className="mt-4 text-sm text-yellow-400">
                  {statsError}. Old
                  saved data is shown.
                </div>
              )}
            </div>

            {/* RIGHT STATS */}

            <div className="space-y-4">
              <div className="rounded-2xl border border-[#243041] bg-[#0f1623] p-5">
                <div className="text-sm text-gray-400">
                  FACEIT ELO
                </div>

                <div className="mt-2 text-4xl font-black text-orange-400">
                  {playerInfo?.elo ||
                    "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-[#243041] bg-[#0f1623] p-5">
                <div className="text-sm text-gray-400">
                  PLAYER RATING
                </div>

                <div
                  className={`mt-2 text-4xl font-black ${
                    averageRating >= 1.1
                      ? "text-green-400"
                      : averageRating >= 1
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {averageRating
                    ? averageRating.toFixed(
                        2
                      )
                    : "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-[#243041] bg-[#0f1623] p-5">
                <div className="text-sm text-gray-400">
                  MATCHES
                </div>

                <div className="mt-2 text-4xl font-black">
                  {totalMatches}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECOND ROW */}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          {/* PERFORMANCE */}

          <div className="rounded-3xl border border-[#243041] bg-[#111823] p-6">
            <h2 className="mb-6 text-2xl font-black">
              Performance
            </h2>

            {[
              {
                label: "ADR",
                value: avgAdr,
                max: 120,
                digits: 1,
              },
              {
                label: "K/D",
                value: avgKd,
                max: 2,
                digits: 2,
              },
              {
                label: "HS%",
                value: avgHs,
                max: 100,
                digits: 1,
              },
              {
                label: "Kills",
                value: avgKills,
                max: 30,
                digits: 1,
              },
              {
                label: "Deaths",
                value: avgDeaths,
                max: 30,
                digits: 1,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="mb-5"
              >
                <div className="mb-1 flex justify-between">
                  <span>
                    {stat.label}
                  </span>

                  <span className="font-bold">
                    {stat.value.toFixed(
                      stat.digits
                    )}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[#1a2433]">
                  <div
                    className="h-full bg-orange-500"
                    style={{
                      width: `${Math.min(
                        (
                          stat.value /
                          stat.max
                        ) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* RECENT MATCHES */}

          <div className="rounded-3xl border border-[#243041] bg-[#111823] p-6">
            <h2 className="mb-6 text-2xl font-black">
              Recent Matches
            </h2>

            {playerMatches.length ? (
              playerMatches
                .slice(0, 10)
                .map(
                  (
                    match,
                    index
                  ) => (
                    <Link
                      key={`${match.matchId}-${index}`}
                      to={`/matches/${match.matchId}`}
                      className="flex items-center justify-between rounded border-b border-[#243041] px-2 py-3 transition-colors hover:bg-[#151e2b]"
                    >
                      <div>
                        <div className="font-medium">
                          {match.opponent
                            ?.teamName ||
                            "Unknown"}
                        </div>

                        <div className="text-sm text-gray-400">
                          {match.map}
                        </div>

                        {match.date && (
                          <div className="mt-1 text-xs text-gray-500">
                            {new Date(
                              match.date
                            ).toLocaleDateString(
                              "ru-RU"
                            )}
                          </div>
                        )}
                      </div>

                      <div
                        className={`font-bold ${
                          match.rating >=
                          1.15
                            ? "text-green-400"
                            : match.rating <
                                0.95
                              ? "text-red-400"
                              : "text-orange-400"
                        }`}
                      >
                        {toNumber(
                          match.rating
                        ).toFixed(2)}
                      </div>
                    </Link>
                  )
                )
            ) : (
              <div className="text-gray-500">
                No match statistics
                found
              </div>
            )}
          </div>
        </div>

        {/* TEAM HISTORY */}

        {transfers.length > 0 && (
          <div className="mt-8 rounded-3xl border border-[#243041] bg-[#111823] p-6">
            <h2 className="mb-6 text-2xl font-black">
              Team History
            </h2>

            <div className="space-y-4">
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
                      className="flex items-center justify-between border-b border-[#243041] pb-4"
                    >
                      <div>
                        <div className="font-bold text-white">
                          {
                            transfer.from
                          }
                          {" → "}
                          {
                            transfer.to
                          }
                        </div>

                        <div className="mt-1 text-sm text-gray-500">
                          Transfer
                        </div>
                      </div>

                      <div className="text-sm text-gray-400">
                        {
                          transfer.date
                        }
                      </div>
                    </div>
                  )
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerPage;