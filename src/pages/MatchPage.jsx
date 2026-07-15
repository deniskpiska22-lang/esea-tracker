import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useParams,
} from "react-router-dom";

import matchesData from "../data/matches";
import upcomingMatches from "../data/upcomingMatches";
import teams from "../data/teams";
import matchStatsCompact from "../data/matchStatsCompact.json";

import { calculatePlayerMatchRating } from "../utils/calculatePlayerRating";
import { supabase } from "../lib/supabaseClient";

const LIVE_STATUSES = new Set([
  "LIVE",
  "ONGOING",
  "MATCH_STATUS_ONGOING",
]);

const FINISHED_STATUSES = new Set([
  "FINISHED",
  "MATCH_STATUS_FINISHED",
]);

function normalizeName(value = "") {
  return String(value || "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function parseJsonValue(value, fallback) {
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

function findLocalTeam(faceitTeamId, fallbackName) {
  return (
    teams.find(
      (team) =>
        faceitTeamId &&
        team.faceitTeamId === faceitTeamId
    ) ||
    teams.find(
      (team) =>
        fallbackName &&
        normalizeName(team.name) ===
          normalizeName(fallbackName)
    ) ||
    null
  );
}

function normalizeDatabaseMatch(row) {
  const rawMapScores = parseJsonValue(
    row.map_scores,
    []
  );

  const rawPlayerStats = parseJsonValue(
    row.player_stats,
    null
  );

  return {
    id: row.id,
    matchId: row.id,

    status:
      row.status ||
      "UNKNOWN",

    bestOf:
      row.best_of ??
      null,

    season:
      row.competition_name ||
      "ESEA League",

    scheduledAt:
      row.scheduled_at ||
      null,

    startedAt:
      row.started_at ||
      null,

    finishedAt:
      row.finished_at ||
      null,

    team1: {
      id:
        row.team1_id ||
        null,

      name:
        row.team1_name ||
        "TBD",

      slug:
        row.team1_slug ||
        null,

      logo:
        row.team1_logo ||
        null,
    },

    team2: {
      id:
        row.team2_id ||
        null,

      name:
        row.team2_name ||
        "TBD",

      slug:
        row.team2_slug ||
        null,

      logo:
        row.team2_logo ||
        null,
    },

    team1Score:
      toNumber(row.team1_score),

    team2Score:
      toNumber(row.team2_score),

    mapScores:
      Array.isArray(rawMapScores)
        ? rawMapScores
        : [],

    playerStats:
      rawPlayerStats &&
      typeof rawPlayerStats === "object"
        ? rawPlayerStats
        : null,

    statsSynced:
      Boolean(row.stats_synced),

    faceitUrl:
      row.faceit_url ||
      `https://www.faceit.com/en/cs2/room/${row.id}`,
  };
}

function formatDateTime(value) {
  if (!value) {
    return "Date TBD";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(parsed);
}

function formatMapName(value) {
  const rawName = String(
    value || "Unknown"
  ).replace(/^de_/i, "");

  if (!rawName) {
    return "Unknown";
  }

  return (
    rawName.charAt(0).toUpperCase() +
    rawName.slice(1)
  );
}

function getRecentMatchesForTeam(team) {
  if (!team?.slug) {
    return [];
  }

  const threeMonthsAgo = new Date();

  threeMonthsAgo.setMonth(
    threeMonthsAgo.getMonth() - 3
  );

  return matchesData
    .filter(
      (item) =>
        item.teamSlug === team.slug &&
        new Date(item.date) >= threeMonthsAgo
    )
    .sort(
      (first, second) =>
        new Date(second.date) -
        new Date(first.date)
    );
}

function TeamHero({
  team,
  align = "left",
}) {
  return (
    <div
      className={`flex flex-col items-center gap-4 ${
        align === "right"
          ? "md:flex-row-reverse md:justify-start"
          : "md:flex-row"
      }`}
    >
      {team.logo ? (
        <img
          src={team.logo}
          alt={team.name}
          className="h-20 w-20 rounded-xl bg-[#0b0f14] object-contain p-2 md:h-24 md:w-24"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-[#243041] bg-[#0b0f14] text-2xl font-black text-gray-500 md:h-24 md:w-24">
          ?
        </div>
      )}

      {team.slug ? (
        <Link
          to={`/team/${team.slug}`}
          className="text-center text-2xl font-black transition-colors hover:text-orange-400 md:text-4xl"
        >
          {team.name}
        </Link>
      ) : (
        <div className="text-center text-2xl font-black md:text-4xl">
          {team.name}
        </div>
      )}
    </div>
  );
}

function RecentMatchesCard({
  displayTeam,
  localTeam,
  matches,
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#243041] bg-[#111823]">
      <div className="border-b border-[#243041] px-5 py-4">
        <div className="text-lg font-black">
          {displayTeam.name}
        </div>
      </div>

      {!localTeam ? (
        <div className="p-6 text-gray-500">
          Team is not in CIS Rankings
        </div>
      ) : matches.length === 0 ? (
        <div className="p-6 text-gray-500">
          No recent matches
        </div>
      ) : (
        <div className="max-h-[340px] overflow-y-auto">
          {matches.map((item) => (
            <Link
              key={`${item.matchId}-${item.teamSlug}`}
              to={`/matches/${item.matchId}`}
              className="flex items-center justify-between border-b border-[#1d2634] px-5 py-3 transition-colors last:border-b-0 hover:bg-[#151e2b]"
            >
              <div>
                <div className="font-medium">
                  {item.opponentName}
                </div>

                <div className="text-xs text-gray-500">
                  {item.date}
                </div>
              </div>

              <div
                className={`font-black ${
                  item.won
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {item.boScore}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchPage() {
  const location = useLocation();

  const {
    slug: routeSlug,
    matchId,
  } = useParams();

  const finishedMatch = useMemo(
    () =>
      matchesData.find(
        (item) =>
          item.matchId === matchId ||
          item.id === matchId
      ) || null,
    [matchId]
  );

  const upcomingMatch = useMemo(
    () =>
      upcomingMatches.find(
        (item) =>
          item.matchId === matchId ||
          item.id === matchId
      ) || null,
    [matchId]
  );

  const [liveData, setLiveData] =
    useState(null);

  const [loadingLive, setLoadingLive] =
    useState(true);

  const [liveError, setLiveError] =
    useState("");

  const loadLiveMatch = useCallback(
    async () => {
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
          .select("*")
          .eq("id", matchId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          setLiveData(
            normalizeDatabaseMatch(data)
          );

          setLiveError("");
        }
      } catch (error) {
        console.error(
          "Failed to load match:",
          error
        );

        setLiveError(
          "Failed to update match"
        );
      } finally {
        setLoadingLive(false);
      }
    },
    [matchId]
  );

  useEffect(() => {
    setLoadingLive(true);
    loadLiveMatch();
  }, [loadLiveMatch]);

  const normalizedStatus =
    liveData?.status?.toUpperCase() ||
    "";

  const isLive =
    LIVE_STATUSES.has(
      normalizedStatus
    );

  const apiSaysFinished =
    FINISHED_STATUSES.has(
      normalizedStatus
    );

  useEffect(() => {
    const intervalId =
      window.setInterval(
        loadLiveMatch,
        isLive
          ? 15000
          : 30000
      );

    return () => {
      window.clearInterval(
        intervalId
      );
    };
  }, [isLive, loadLiveMatch]);

  if (
    !finishedMatch &&
    !upcomingMatch &&
    !liveData &&
    loadingLive
  ) {
    return (
      <div className="min-h-screen bg-[#0b0f14] p-8 text-center text-white">
        Loading match...
      </div>
    );
  }

  if (
    !finishedMatch &&
    !upcomingMatch &&
    !liveData
  ) {
    return (
      <div className="min-h-screen bg-[#0b0f14] p-8 text-center text-white">
        <div className="text-xl font-bold">
          Match not found
        </div>

        {liveError && (
          <div className="mt-2 text-sm text-red-400">
            {liveError}
          </div>
        )}
      </div>
    );
  }

  const finishedTeam = teams.find(
    (team) =>
      team.slug ===
      finishedMatch?.teamSlug
  );

  const finishedOpponent =
    teams.find(
      (team) =>
        normalizeName(team.name) ===
        normalizeName(
          finishedMatch?.opponentName
        )
    );

  const displayTeam1 =
    liveData?.team1 ||
    upcomingMatch?.team1 || {
      id:
        finishedTeam?.faceitTeamId ||
        null,

      name:
        finishedTeam?.name ||
        finishedMatch?.teamName ||
        "TBD",

      slug:
        finishedTeam?.slug ||
        finishedMatch?.teamSlug ||
        null,

      logo:
        finishedTeam?.logo ||
        null,
    };

  const displayTeam2 =
    liveData?.team2 ||
    upcomingMatch?.team2 || {
      id:
        finishedOpponent?.faceitTeamId ||
        null,

      name:
        finishedOpponent?.name ||
        finishedMatch?.opponentName ||
        "TBD",

      slug:
        finishedOpponent?.slug ||
        null,

      logo:
        finishedOpponent?.logo ||
        null,
    };

  /*
   * Определяем рейтинговые команды независимо
   * для левой и правой стороны.
   *
   * Поэтому список всегда остаётся под той
   * командой, которая расположена в шапке.
   */
  const leftLocalTeam = findLocalTeam(
    displayTeam1.id,
    displayTeam1.name
  );

  const rightLocalTeam = findLocalTeam(
    displayTeam2.id,
    displayTeam2.name
  );

  const leftRecentMatches =
    getRecentMatchesForTeam(
      leftLocalTeam
    );

  const rightRecentMatches =
    getRecentMatchesForTeam(
      rightLocalTeam
    );

  const displayScore = liveData
    ? `${liveData.team1Score} : ${liveData.team2Score}`
    : finishedMatch?.boScore ||
      "- : -";

  const displaySeason =
    liveData?.season ||
    upcomingMatch?.season ||
    upcomingMatch?.championshipName ||
    finishedMatch?.season ||
    "ESEA League";

  const displayBestOf =
    liveData?.bestOf ??
    upcomingMatch?.bestOf ??
    finishedMatch?.bestOf ??
    "?";

  const displayDate =
    liveData?.scheduledAt ||
    upcomingMatch?.scheduledAt ||
    finishedMatch?.date ||
    null;

  const displayFaceitUrl =
    liveData?.faceitUrl ||
    upcomingMatch?.faceitUrl ||
    finishedMatch?.faceitUrl ||
    "#";

  /*
   * Для кнопки Back приоритет имеет routeSlug.
   * Затем берём slug фактической рейтинговой команды.
   */
  const navigationSlug =
    routeSlug ||
    leftLocalTeam?.slug ||
    rightLocalTeam?.slug ||
    finishedMatch?.teamSlug ||
    null;

  const stats =
    liveData?.playerStats ||
    matchStatsCompact[matchId] ||
    null;

  const databaseMapScores =
    Array.isArray(
      liveData?.mapScores
    )
      ? liveData.mapScores.map(
          (map) => {
            const displayedTeamId =
              liveData?.team1?.id;

            const displayedTeamName =
              liveData?.team1?.name;

            const mapFirstIsDisplayedTeam =
              Boolean(
                displayedTeamId &&
                map.team1_id ===
                  displayedTeamId
              ) ||
              Boolean(
                displayedTeamName &&
                normalizeName(
                  map.team1_name
                ) ===
                  normalizeName(
                    displayedTeamName
                  )
              );

            const teamScore =
              toNumber(
                mapFirstIsDisplayedTeam
                  ? map.team1_score
                  : map.team2_score
              );

            const opponentScore =
              toNumber(
                mapFirstIsDisplayedTeam
                  ? map.team2_score
                  : map.team1_score
              );

            return {
              map:
                map.map ||
                "Unknown",

              teamScore,

              opponentScore,

              won:
                teamScore >
                opponentScore,
            };
          }
        )
      : [];

  const displayedMapScores =
    databaseMapScores.length > 0
      ? databaseMapScores
      : finishedMatch?.mapScores ||
        [];

  const orderedTeams = [
    ...(Array.isArray(stats?.teams)
      ? stats.teams
      : []),
  ].sort(
    (first, second) => {
      const displayedTeamId =
        displayTeam1.id ||
        null;

      const displayedTeamName =
        displayTeam1.name ||
        "";

      const firstMatches =
        Boolean(
          displayedTeamId &&
          first.teamId ===
            displayedTeamId
        ) ||
        normalizeName(
          first.teamName
        ) ===
          normalizeName(
            displayedTeamName
          );

      const secondMatches =
        Boolean(
          displayedTeamId &&
          second.teamId ===
            displayedTeamId
        ) ||
        normalizeName(
          second.teamName
        ) ===
          normalizeName(
            displayedTeamName
          );

      if (firstMatches) {
        return -1;
      }

      if (secondMatches) {
        return 1;
      }

      return 0;
    }
  );

  /*
   * H2H пока оставляем на старых matchesData.
   * Он строится только если обе команды есть
   * в локальном рейтинге.
   */
  const h2hMatches =
    leftLocalTeam &&
    rightLocalTeam
      ? matchesData.filter(
          (item) => {
            const directMatch =
              item.teamSlug ===
                leftLocalTeam.slug &&
              normalizeName(
                item.opponentName
              ) ===
                normalizeName(
                  rightLocalTeam.name
                );

            const reverseMatch =
              item.teamSlug ===
                rightLocalTeam.slug &&
              normalizeName(
                item.opponentName
              ) ===
                normalizeName(
                  leftLocalTeam.name
                );

            return (
              directMatch ||
              reverseMatch
            );
          }
        )
      : [];

  const uniqueH2HMatches = [
    ...new Map(
      h2hMatches.map(
        (item) => [
          item.matchId,
          item,
        ]
      )
    ).values(),
  ];

  let leftTeamWins = 0;
  let rightTeamWins = 0;

  uniqueH2HMatches.forEach(
    (item) => {
      const [teamScore, opponentScore] =
        String(item.boScore)
          .split(":")
          .map(Number);

      const itemIsLeftTeam =
        item.teamSlug ===
        leftLocalTeam?.slug;

      if (itemIsLeftTeam) {
        if (
          teamScore >
          opponentScore
        ) {
          leftTeamWins += 1;
        } else {
          rightTeamWins += 1;
        }
      } else if (
        teamScore >
        opponentScore
      ) {
        rightTeamWins += 1;
      } else {
        leftTeamWins += 1;
      }
    }
  );

  const formatH2HScore = (
    item
  ) => {
    if (
      item.teamSlug ===
      leftLocalTeam?.slug
    ) {
      return item.boScore;
    }

    return String(
      item.boScore
    )
      .split(":")
      .reverse()
      .join(":");
  };

  const showFinishedSections =
    Boolean(finishedMatch) ||
    apiSaysFinished;

  return (
    <div className="min-h-screen bg-[#0b0f14] p-4 text-white md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            to={
              navigationSlug
                ? `/team/${navigationSlug}/matches`
                : "/"
            }
            className="text-orange-400 hover:text-orange-300"
          >
            ← Back to Matches
          </Link>

          {isLive && (
            <div className="animate-pulse rounded-full border border-red-500/30 bg-red-500/15 px-4 py-1 text-sm font-bold text-red-400">
              ● LIVE
            </div>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-[#243041] bg-[#111823]">
          <div className="p-6 md:p-10">
            <div className="grid gap-8 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <TeamHero
                team={displayTeam1}
              />

              <div className="text-center">
                <div className="mb-4 inline-flex rounded-full border border-orange-500/30 bg-orange-500/15 px-4 py-1 text-sm font-bold text-orange-400">
                  BO{displayBestOf}
                </div>

                <div className="text-5xl font-black text-orange-400 md:text-7xl">
                  {displayScore}
                </div>

                <div className="mt-4 text-gray-400">
                  {displaySeason}
                </div>

                <div className="mt-1 text-sm text-gray-500">
                  {formatDateTime(
                    displayDate
                  )}
                </div>

                {!isLive &&
                  !showFinishedSections && (
                    <div className="mt-3 text-sm font-semibold text-orange-400">
                      Upcoming match
                    </div>
                  )}

                {showFinishedSections &&
                  !isLive && (
                    <div className="mt-3 text-sm text-gray-500">
                      Final result
                    </div>
                  )}
              </div>

              <TeamHero
                team={displayTeam2}
                align="right"
              />
            </div>
          </div>
        </div>

        {/* MAPS */}

        {showFinishedSections &&
          displayedMapScores.length >
            0 && (
            <div className="mt-8">
              <h2 className="mb-4 text-2xl font-black">
                Maps
              </h2>

              <div className="grid gap-4 md:grid-cols-3">
                {displayedMapScores.map(
                  (map, index) => {
                    const formattedName =
                      formatMapName(
                        map.map
                      );

                    const imageName =
                      formattedName.toLowerCase();

                    return (
                      <div
                        key={`${map.map}-${index}`}
                        className="overflow-hidden rounded-2xl border border-[#243041] bg-[#111823]"
                      >
                        <div
                          className="relative h-28 bg-cover bg-center"
                          style={{
                            backgroundImage:
                              `url(/maps/${imageName}.png)`,
                          }}
                        >
                          <div className="absolute inset-0 bg-black/60" />

                          <div className="relative z-10 flex h-full items-end p-4">
                            <div className="text-2xl font-black">
                              {
                                formattedName
                              }
                            </div>
                          </div>
                        </div>

                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">
                              Map Score
                            </span>

                            <span
                              className={`text-xl font-black ${
                                map.won
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {toNumber(
                                map.teamScore
                              )}{" "}
                              :{" "}
                              {toNumber(
                                map.opponentScore
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

        {/* PLAYER STATISTICS */}

        {showFinishedSections &&
          Array.isArray(
            stats?.teams
          ) &&
          stats.teams.length > 0 && (
            <div className="mt-10">
              <h2 className="mb-4 text-2xl font-black">
                Player Statistics
              </h2>

              <div className="grid gap-6 lg:grid-cols-2">
                {orderedTeams.map(
                  (
                    team,
                    teamIndex
                  ) => {
                    const players =
                      Array.isArray(
                        team.players
                      )
                        ? team.players
                        : [];

                    const opponent =
                      stats.teams.find(
                        (item) =>
                          item.teamId !==
                          team.teamId
                      );

                    return (
                      <div
                        key={`${
                          team.teamId ||
                          team.teamName
                        }-${teamIndex}`}
                        className="overflow-hidden rounded-2xl border border-[#243041] bg-[#111823]"
                      >
                        <div className="border-b border-[#243041] px-5 py-4">
                          <div className="text-xl font-black">
                            {
                              team.teamName
                            }
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[520px]">
                            <thead>
                              <tr className="text-sm text-gray-500">
                                <th className="p-3 text-left">
                                  Player
                                </th>

                                <th>R</th>
                                <th>K</th>
                                <th>D</th>
                                <th>ADR</th>
                                <th>HS%</th>
                                <th>K/D</th>
                              </tr>
                            </thead>

                            <tbody>
                              {[...players]
                                .sort(
                                  (
                                    first,
                                    second
                                  ) =>
                                    calculatePlayerMatchRating(
                                      second
                                    ) -
                                    calculatePlayerMatchRating(
                                      first
                                    )
                                )
                                .map(
                                  (
                                    player,
                                    playerIndex
                                  ) => {
                                    const normalizedPlayer =
                                      {
                                        ...player,

                                        kills:
                                          toNumber(
                                            player.kills
                                          ),

                                        deaths:
                                          toNumber(
                                            player.deaths
                                          ),

                                        assists:
                                          toNumber(
                                            player.assists
                                          ),

                                        adr:
                                          toNumber(
                                            player.adr
                                          ),

                                        hsRate:
                                          toNumber(
                                            player.hsRate
                                          ),

                                        kd:
                                          toNumber(
                                            player.kd
                                          ),

                                        kast:
                                          toNumber(
                                            player.kast
                                          ),

                                        mvps:
                                          toNumber(
                                            player.mvps
                                          ),
                                      };

                                    const rating =
                                      calculatePlayerMatchRating(
                                        normalizedPlayer,
                                        toNumber(
                                          team.score
                                        ),
                                        toNumber(
                                          opponent?.score
                                        )
                                      );

                                    return (
                                      <tr
                                        key={
                                          player.playerId ||
                                          `${player.nickname}-${playerIndex}`
                                        }
                                        className="border-t border-[#1d2634] hover:bg-[#151e2b]"
                                      >
                                        <td className="p-3 font-semibold">
                                          <Link
                                            to={`/players/${encodeURIComponent(
                                              player.nickname ||
                                                "Unknown"
                                            )}`}
                                            state={{
                                              from:
                                                location.pathname,

                                              label:
                                                "← Back to Match",
                                            }}
                                            className="transition-colors hover:text-orange-400"
                                          >
                                            {player.nickname ||
                                              "Unknown"}
                                          </Link>
                                        </td>

                                        <td
                                          className={`text-center font-black ${
                                            rating >=
                                            1.15
                                              ? "text-green-400"
                                              : rating <
                                                  0.95
                                                ? "text-red-400"
                                                : "text-orange-400"
                                          }`}
                                        >
                                          {toNumber(
                                            rating
                                          ).toFixed(
                                            2
                                          )}
                                        </td>

                                        <td className="text-center">
                                          {
                                            normalizedPlayer.kills
                                          }
                                        </td>

                                        <td className="text-center">
                                          {
                                            normalizedPlayer.deaths
                                          }
                                        </td>

                                        <td className="text-center">
                                          {normalizedPlayer.adr.toFixed(
                                            1
                                          )}
                                        </td>

                                        <td className="text-center">
                                          {normalizedPlayer.hsRate.toFixed(
                                            0
                                          )}
                                          %
                                        </td>

                                        <td
                                          className={`text-center font-bold ${
                                            normalizedPlayer.kd >=
                                            1
                                              ? "text-green-400"
                                              : "text-red-400"
                                          }`}
                                        >
                                          {normalizedPlayer.kd.toFixed(
                                            2
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  }
                                )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

        {/* RECENT MATCHES */}

        {showFinishedSections && (
          <div className="mt-10">
            <h2 className="mb-4 text-2xl font-black">
              Recent Matches (Past 3 Months)
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              <RecentMatchesCard
                displayTeam={displayTeam1}
                localTeam={leftLocalTeam}
                matches={leftRecentMatches}
              />

              <RecentMatchesCard
                displayTeam={displayTeam2}
                localTeam={rightLocalTeam}
                matches={rightRecentMatches}
              />
            </div>
          </div>
        )}

        {/* H2H */}

        {showFinishedSections &&
          leftLocalTeam &&
          rightLocalTeam &&
          uniqueH2HMatches.length >
            0 && (
            <div className="mt-10">
              <h2 className="mb-4 text-2xl font-black">
                Head to Head
              </h2>

              <div className="overflow-hidden rounded-2xl border border-[#243041] bg-[#111823]">
                <div className="grid grid-cols-3 items-center border-b border-[#243041] p-6 text-center">
                  <div className="flex flex-col items-center">
                    {displayTeam1.logo && (
                      <img
                        src={
                          displayTeam1.logo
                        }
                        alt={
                          displayTeam1.name
                        }
                        className="mb-2 h-12 w-12 object-contain"
                      />
                    )}

                    <div className="text-lg text-gray-400">
                      {
                        displayTeam1.name
                      }
                    </div>

                    <div className="text-5xl font-black text-green-400">
                      {leftTeamWins}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">
                      H2H Record
                    </div>

                    <div className="text-xl font-bold">
                      Matches:{" "}
                      {
                        uniqueH2HMatches.length
                      }
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    {displayTeam2.logo && (
                      <img
                        src={
                          displayTeam2.logo
                        }
                        alt={
                          displayTeam2.name
                        }
                        className="mb-2 h-12 w-12 object-contain"
                      />
                    )}

                    <div className="text-lg text-gray-400">
                      {
                        displayTeam2.name
                      }
                    </div>

                    <div className="text-5xl font-black text-red-400">
                      {rightTeamWins}
                    </div>
                  </div>
                </div>

                {uniqueH2HMatches.map(
                  (item) => (
                    <Link
                      key={`${item.matchId}-${item.teamSlug}`}
                      to={`/matches/${item.matchId}`}
                      className="relative flex items-center justify-between border-b border-[#1d2634] px-5 py-4 transition-colors last:border-b-0 hover:bg-[#151e2b]"
                    >
                      <div className="font-medium">
                        {item.teamSlug ===
                        leftLocalTeam.slug
                          ? `${item.teamName} vs ${item.opponentName}`
                          : `${item.opponentName} vs ${item.teamName}`}
                      </div>

                      <div className="hidden text-center md:block">
                        <div className="text-sm font-medium text-gray-300">
                          {
                            item.season
                          }
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          {
                            item.date
                          }
                        </div>
                      </div>

                      <div className="font-black text-orange-400">
                        {formatH2HScore(
                          item
                        )}
                      </div>
                    </Link>
                  )
                )}
              </div>
            </div>
          )}

        {/* MATCH INFORMATION */}

        <div className="mt-10">
          <h2 className="mb-4 text-2xl font-black">
            Match Information
          </h2>

          <div className="rounded-2xl border border-[#243041] bg-[#111823] p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="text-sm text-gray-500">
                  Teams
                </div>

                <div className="text-lg font-bold">
                  {displayTeam1.name} vs{" "}
                  {displayTeam2.name}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">
                  League
                </div>

                <div className="text-lg font-bold">
                  {displaySeason}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">
                  Match Date
                </div>

                <div className="text-lg font-bold">
                  {formatDateTime(
                    displayDate
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">
                  Format
                </div>

                <div className="text-lg font-bold">
                  BO{displayBestOf}
                </div>
              </div>
            </div>

            <a
              href={displayFaceitUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 font-bold transition-all hover:bg-orange-600"
            >
              Open FACEIT Match Room →
            </a>

            {liveError && (
              <div className="mt-3 text-sm text-yellow-400">
                Live update unavailable.
                Static match data is shown.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MatchPage;