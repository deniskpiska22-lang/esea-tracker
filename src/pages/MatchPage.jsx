import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import matchesData from "../data/matches";
import upcomingMatches from "../data/upcomingMatches";
import teams from "../data/teams";
import matchStatsCompact from "../data/matchStatsCompact.json";
import { calculatePlayerMatchRating } from "../utils/calculatePlayerRating";

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
  return value.replace(/\s+/g, "").toLowerCase();
}

function findLocalTeam(faceitTeamId, fallbackName) {
  return teams.find((team) => {
    if (
      faceitTeamId &&
      team.faceitTeamId === faceitTeamId
    ) {
      return true;
    }

    return (
      fallbackName &&
      normalizeName(team.name) === normalizeName(fallbackName)
    );
  });
}

function normalizeFaceitTeam(team = {}) {
  const faceitTeamId =
    team.faction_id ||
    team.team_id ||
    team.premade_team_id ||
    null;

  const fallbackName =
    team.name ||
    team.nickname ||
    "TBD";

  const localTeam = findLocalTeam(
    faceitTeamId,
    fallbackName
  );

  return {
    id: faceitTeamId,
    name: localTeam?.name || fallbackName,
    slug: localTeam?.slug || null,
    logo:
      localTeam?.logo ||
      team.avatar ||
      team.logo ||
      null,
  };
}

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString();
}

function normalizeFaceitMatch(data) {
  const teamEntries = Object.entries(data?.teams || {});
  const firstEntry = teamEntries[0] || [];
  const secondEntry = teamEntries[1] || [];

  const firstKey = firstEntry[0];
  const secondKey = secondEntry[0];

  const firstTeam = firstEntry[1] || {};
  const secondTeam = secondEntry[1] || {};

  return {
    id: data.match_id || data.id,
    matchId: data.match_id || data.id,
    status: data.status || "UNKNOWN",
    bestOf: data.best_of ?? null,
    season:
      data.competition_name ||
      data.competition?.name ||
      "ESEA League",
    scheduledAt:
      toIsoDate(data.scheduled_at) ||
      toIsoDate(data.scheduled_time),
    startedAt:
      toIsoDate(data.started_at) ||
      toIsoDate(data.started_time),
    finishedAt:
      toIsoDate(data.finished_at) ||
      toIsoDate(data.finished_time),
    team1: normalizeFaceitTeam(firstTeam),
    team2: normalizeFaceitTeam(secondTeam),
    team1Score:
      data.results?.score?.[firstKey] ??
      firstTeam.score ??
      0,
    team2Score:
      data.results?.score?.[secondKey] ??
      secondTeam.score ??
      0,
    faceitUrl:
      data.faceit_url ||
      `https://www.faceit.com/en/cs2/room/${
        data.match_id || data.id
      }`,
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

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function TeamHero({ team, align = "left" }) {
  const content = (
    <>
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
    </>
  );

  return (
    <div
      className={`flex flex-col items-center gap-4 ${
        align === "right"
          ? "md:flex-row-reverse md:justify-start"
          : "md:flex-row"
      }`}
    >
      {content}
    </div>
  );
}

function MatchPage() {
  const location = useLocation();
  const { slug: routeSlug, matchId } = useParams();

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

  const [liveData, setLiveData] = useState(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const [liveError, setLiveError] = useState("");

  const loadLiveMatch = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/match?matchId=${encodeURIComponent(matchId)}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Match request failed: ${response.status}`
        );
      }

      const data = await response.json();

      setLiveData(normalizeFaceitMatch(data));
      setLiveError("");
    } catch (error) {
      console.error(error);
      setLiveError("Failed to update match");
    } finally {
      setLoadingLive(false);
    }
  }, [matchId]);

  useEffect(() => {
    setLoadingLive(true);
    loadLiveMatch();
  }, [loadLiveMatch]);

  const normalizedStatus =
    liveData?.status?.toUpperCase() || "";

  const isLive = LIVE_STATUSES.has(normalizedStatus);

  const apiSaysFinished =
    FINISHED_STATUSES.has(normalizedStatus);

  useEffect(() => {
    if (!isLive) {
      return undefined;
    }

    const intervalId = window.setInterval(
      loadLiveMatch,
      15000
    );

    return () => {
      window.clearInterval(intervalId);
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

  if (!finishedMatch && !upcomingMatch && !liveData) {
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
    (team) => team.slug === finishedMatch?.teamSlug
  );

  const finishedOpponent = teams.find(
    (team) =>
      normalizeName(team.name) ===
      normalizeName(finishedMatch?.opponentName)
  );

  const displayTeam1 =
    liveData?.team1 ||
    upcomingMatch?.team1 || {
      name:
        finishedTeam?.name ||
        finishedMatch?.teamName ||
        "TBD",
      slug:
        finishedTeam?.slug ||
        finishedMatch?.teamSlug ||
        null,
      logo: finishedTeam?.logo || null,
    };

  const displayTeam2 =
    liveData?.team2 ||
    upcomingMatch?.team2 || {
      name:
        finishedOpponent?.name ||
        finishedMatch?.opponentName ||
        "TBD",
      slug: finishedOpponent?.slug || null,
      logo: finishedOpponent?.logo || null,
    };

  const displayScore = liveData
    ? `${liveData.team1Score} : ${liveData.team2Score}`
    : finishedMatch?.boScore || "- : -";

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

  const slug =
    routeSlug ||
    finishedMatch?.teamSlug ||
    displayTeam1.slug ||
    displayTeam2.slug ||
    null;

  const stats = matchStatsCompact[matchId];
  const currentTeam = teams.find(
    (team) => team.slug === slug
  );

  const orderedTeams = [...(stats?.teams || [])].sort(
    (first, second) => {
      const currentName = normalizeName(currentTeam?.name);
      const firstName = normalizeName(first.teamName);
      const secondName = normalizeName(second.teamName);

      if (firstName === currentName) return -1;
      if (secondName === currentName) return 1;
      return 0;
    }
  );

  const opponentTeam = finishedOpponent || null;
  const teamLogo =
    finishedTeam?.logo ||
    currentTeam?.logo ||
    displayTeam1.logo ||
    null;
  const opponentLogo =
    opponentTeam?.logo ||
    displayTeam2.logo ||
    null;

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(
    threeMonthsAgo.getMonth() - 3
  );

  const currentTeamMatches = finishedMatch
    ? matchesData
        .filter(
          (item) =>
            item.teamSlug === slug &&
            new Date(item.date) >= threeMonthsAgo
        )
        .sort(
          (first, second) =>
            new Date(second.date) -
            new Date(first.date)
        )
    : [];

  const opponentMatches =
    finishedMatch && opponentTeam
      ? matchesData
          .filter(
            (item) =>
              item.teamSlug === opponentTeam.slug &&
              new Date(item.date) >= threeMonthsAgo
          )
          .sort(
            (first, second) =>
              new Date(second.date) -
              new Date(first.date)
          )
      : [];

  const h2hMatches =
    finishedMatch && opponentTeam
      ? matchesData.filter((item) => {
          return (
            (item.teamSlug === slug &&
              normalizeName(item.opponentName) ===
                normalizeName(opponentTeam.name)) ||
            (item.teamSlug === opponentTeam.slug &&
              normalizeName(item.opponentName) ===
                normalizeName(finishedMatch.teamName))
          );
        })
      : [];

  const uniqueH2HMatches = [
    ...new Map(
      h2hMatches.map((item) => [
        item.matchId,
        item,
      ])
    ).values(),
  ];

  let teamWins = 0;
  let opponentWins = 0;

  uniqueH2HMatches.forEach((item) => {
    const [left, right] = String(item.boScore)
      .split(":")
      .map(Number);

    if (item.teamSlug === slug) {
      if (left > right) teamWins += 1;
      else opponentWins += 1;
    } else if (left > right) {
      opponentWins += 1;
    } else {
      teamWins += 1;
    }
  });

  const formatH2HScore = (item) => {
    if (item.teamSlug === slug) {
      return item.boScore;
    }

    return String(item.boScore)
      .split(":")
      .reverse()
      .join(":");
  };

  const showFinishedSections =
    Boolean(finishedMatch) || apiSaysFinished;

  return (
    <div className="min-h-screen bg-[#0b0f14] p-4 text-white md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            to={slug ? `/team/${slug}/matches` : "/"}
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
              <TeamHero team={displayTeam1} />

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
                  {formatDateTime(displayDate)}
                </div>

                {!isLive && !showFinishedSections && (
                  <div className="mt-3 text-sm font-semibold text-orange-400">
                    Upcoming match
                  </div>
                )}

                {showFinishedSections && !isLive && (
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

        {finishedMatch && (
          <div className="mt-8">
            <h2 className="mb-4 text-2xl font-black">
              Maps
            </h2>

            <div className="grid gap-4 md:grid-cols-3">
              {finishedMatch.mapScores?.map(
                (map, index) => {
                  const imageName =
                    map.map?.toLowerCase();

                  return (
                    <div
                      key={`${map.map}-${index}`}
                      className="overflow-hidden rounded-2xl border border-[#243041] bg-[#111823]"
                    >
                      <div
                        className="relative h-28 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(/maps/${imageName}.png)`,
                        }}
                      >
                        <div className="absolute inset-0 bg-black/60" />

                        <div className="relative z-10 flex h-full items-end p-4">
                          <div className="text-2xl font-black">
                            {map.map}
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
                            {map.teamScore} :{" "}
                            {map.opponentScore}
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

        {finishedMatch && stats?.teams && (
          <div className="mt-10">
            <h2 className="mb-4 text-2xl font-black">
              Player Statistics
            </h2>

            <div className="grid gap-6 lg:grid-cols-2">
              {orderedTeams.map((team, teamIndex) => (
                <div
                  key={`${team.teamId}-${teamIndex}`}
                  className="overflow-hidden rounded-2xl border border-[#243041] bg-[#111823]"
                >
                  <div className="border-b border-[#243041] px-5 py-4">
                    <div className="text-xl font-black">
                      {team.teamName}
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
                        {[...(team.players || [])]
                          .sort(
                            (first, second) =>
                              calculatePlayerMatchRating(
                                second
                              ) -
                              calculatePlayerMatchRating(
                                first
                              )
                          )
                          .map((player) => {
                            const opponent =
                              stats.teams.find(
                                (item) =>
                                  item.teamId !==
                                  team.teamId
                              );

                            const rating =
                              calculatePlayerMatchRating(
                                player,
                                team.score,
                                opponent?.score || 0
                              );

                            return (
                              <tr
                                key={player.playerId}
                                className="border-t border-[#1d2634] hover:bg-[#151e2b]"
                              >
                                <td className="p-3 font-semibold">
                                  <Link
                                    to={`/players/${encodeURIComponent(
                                      player.nickname
                                    )}`}
                                    state={{
                                      from:
                                        location.pathname,
                                      label:
                                        "← Back to Match",
                                    }}
                                    className="transition-colors hover:text-orange-400"
                                  >
                                    {player.nickname}
                                  </Link>
                                </td>

                                <td
                                  className={`text-center font-black ${
                                    rating >= 1.15
                                      ? "text-green-400"
                                      : rating < 0.95
                                      ? "text-red-400"
                                      : "text-orange-400"
                                  }`}
                                >
                                  {rating.toFixed(2)}
                                </td>

                                <td className="text-center">
                                  {player.kills ?? 0}
                                </td>

                                <td className="text-center">
                                  {player.deaths ?? 0}
                                </td>

                                <td className="text-center">
                                  {player.adr
                                    ? player.adr.toFixed(1)
                                    : "0.0"}
                                </td>

                                <td className="text-center">
                                  {player.hsRate
                                    ? player.hsRate.toFixed(0)
                                    : 0}
                                  %
                                </td>

                                <td
                                  className={`text-center font-bold ${
                                    (player.kd || 0) >= 1
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  {player.kd
                                    ? player.kd.toFixed(2)
                                    : "0.00"}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {finishedMatch && (
          <div className="mt-10">
            <h2 className="mb-4 text-2xl font-black">
              Recent Matches (Past 3 Months)
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col overflow-hidden rounded-2xl border border-[#243041] bg-[#111823]">
                <div className="border-b border-[#243041] px-5 py-4">
                  <div className="text-lg font-black">
                    {displayTeam1.name}
                  </div>
                </div>

                <div className="max-h-[340px] overflow-y-auto">
                  {currentTeamMatches.map((item) => (
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
                        {item.teamSlug === slug
                          ? item.boScore
                          : String(item.boScore)
                              .split(":")
                              .reverse()
                              .join(":")}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="flex flex-col overflow-hidden rounded-2xl border border-[#243041] bg-[#111823]">
                <div className="border-b border-[#243041] px-5 py-4">
                  <div className="text-lg font-black">
                    {displayTeam2.name}
                  </div>
                </div>

                {opponentTeam ? (
                  <div className="max-h-[340px] overflow-y-auto">
                    {opponentMatches.map((item) => (
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

                        <div className="font-black text-orange-400">
                          {item.boScore}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-gray-500">
                    Team is not in CIS Rankings
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {finishedMatch &&
          opponentTeam &&
          uniqueH2HMatches.length > 0 && (
            <div className="mt-10">
              <h2 className="mb-4 text-2xl font-black">
                Head to Head
              </h2>

              <div className="overflow-hidden rounded-2xl border border-[#243041] bg-[#111823]">
                <div className="grid grid-cols-3 items-center border-b border-[#243041] p-6 text-center">
                  <div className="flex flex-col items-center">
                    {teamLogo && (
                      <img
                        src={teamLogo}
                        alt={displayTeam1.name}
                        className="mb-2 h-12 w-12 object-contain"
                      />
                    )}

                    <div className="text-lg text-gray-400">
                      {displayTeam1.name}
                    </div>

                    <div className="text-5xl font-black text-green-400">
                      {teamWins}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">
                      H2H Record
                    </div>

                    <div className="text-xl font-bold">
                      Matches:{" "}
                      {uniqueH2HMatches.length}
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    {opponentLogo && (
                      <img
                        src={opponentLogo}
                        alt={displayTeam2.name}
                        className="mb-2 h-12 w-12 object-contain"
                      />
                    )}

                    <div className="text-lg text-gray-400">
                      {displayTeam2.name}
                    </div>

                    <div className="text-5xl font-black text-red-400">
                      {opponentWins}
                    </div>
                  </div>
                </div>

                {uniqueH2HMatches.map((item) => (
                  <Link
                    key={`${item.matchId}-${item.teamSlug}`}
                    to={`/matches/${item.matchId}`}
                    className="relative flex items-center justify-between border-b border-[#1d2634] px-5 py-4 transition-colors last:border-b-0 hover:bg-[#151e2b]"
                  >
                    <div className="font-medium">
                      {item.teamSlug === slug
                        ? `${item.teamName} vs ${item.opponentName}`
                        : `${item.opponentName} vs ${item.teamName}`}
                    </div>

                    <div className="hidden text-center md:block">
                      <div className="text-sm font-medium text-gray-300">
                        {item.season}
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        {item.date}
                      </div>
                    </div>

                    <div className="font-black text-orange-400">
                      {formatH2HScore(item)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

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
                  {formatDateTime(displayDate)}
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
                Live update unavailable. Static match data is shown.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MatchPage;