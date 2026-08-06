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
import { calculateMatchRating, normalizeDivisionName } from "../utils/teamRating";
import { supabase } from "../lib/supabaseClient";
import MatchComments from "../components/MatchComments";
import MatchMapResultsSection from "../components/MatchMapResults";
import HeadToHeadCard from "../components/HeadToHeadCard";
import MatchLineups from "../components/MatchLineups";
import TournamentNameLink from "../components/TournamentNameLink";
import { useTeamStats } from "../hooks/useTeamStats";

const LIVE_STATUSES = new Set([
  "LIVE",
  "ONGOING",
  "READY",
  "VOTING",
  "CONFIGURING",
  "MATCH_STATUS_ONGOING",
  "MATCH_STATUS_READY",
  "MATCH_STATUS_VOTING",
  "MATCH_STATUS_CONFIGURING",
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

function normalizePlayerStatsPayload(value) {
  const parsed = parseJsonValue(value, null);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  if (Array.isArray(parsed.teams) && parsed.teams.length > 0) {
    return parsed;
  }

  const players = Array.isArray(parsed.players)
    ? parsed.players
    : [];

  if (players.length === 0) {
    return parsed;
  }

  const teamsByKey = new Map();

  for (const player of players) {
    const key = String(
      player.teamId || player.team_id || player.teamName || player.team_name || "unknown-team"
    );

    if (!teamsByKey.has(key)) {
      teamsByKey.set(key, {
        teamId: player.teamId || player.team_id || null,
        teamName: player.teamName || player.team_name || "Unknown",
        score: 0,
        players: [],
      });
    }

    teamsByKey.get(key).players.push(player);
  }

  const maps = Array.isArray(parsed.maps) ? parsed.maps : [];

  for (const map of maps) {
    const mapTeams = Array.isArray(map?.teams) ? map.teams : [];

    for (const mapTeam of mapTeams) {
      const key = String(
        mapTeam.teamId || mapTeam.team_id || mapTeam.teamName || mapTeam.team_name || "unknown-team"
      );
      const target = teamsByKey.get(key);

      if (target) {
        target.score += toNumber(mapTeam.score);
      }
    }
  }

  return {
    ...parsed,
    teams: [...teamsByKey.values()],
  };
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

  const rawPlayerStats = normalizePlayerStatsPayload(
    row.player_stats
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

function formatMatchTime(value) {
  if (!value) {
    return "--:--";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(parsed);
}

function formatMatchDate(value) {
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

function getMapTeamIdentity(team = {}) {
  return {
    id:
      team?.teamId ||
      team?.team_id ||
      team?.id ||
      null,
    name:
      team?.teamName ||
      team?.team_name ||
      team?.name ||
      null,
    score: toNumber(team?.score),
  };
}

function teamIdentityMatches(team, displayTeam) {
  if (!team || !displayTeam) {
    return false;
  }

  if (
    team.id &&
    displayTeam.id &&
    String(team.id) === String(displayTeam.id)
  ) {
    return true;
  }

  return Boolean(
    team.name &&
    displayTeam.name &&
    normalizeName(team.name) === normalizeName(displayTeam.name)
  );
}

function normalizeDisplayedMapScore(map, displayTeam1, displayTeam2) {
  if (!map || typeof map !== "object") {
    return null;
  }

  /*
   * Новый формат Supabase:
   * { map, team1: { teamId, teamName, score }, team2: {...} }
   */
  const nestedFirst = getMapTeamIdentity(map.team1);
  const nestedSecond = getMapTeamIdentity(map.team2);

  /*
   * Старый плоский формат autoSyncMatches:
   * { team1_id, team1_name, team1_score, ... }
   */
  const first = {
    id:
      nestedFirst.id ||
      map.team1_id ||
      null,
    name:
      nestedFirst.name ||
      map.team1_name ||
      null,
    score: toNumber(
      map.team1_score ??
      map.score1 ??
      nestedFirst.score
    ),
  };

  const second = {
    id:
      nestedSecond.id ||
      map.team2_id ||
      null,
    name:
      nestedSecond.name ||
      map.team2_name ||
      null,
    score: toNumber(
      map.team2_score ??
      map.score2 ??
      nestedSecond.score
    ),
  };

  let left = first;
  let right = second;

  if (
    teamIdentityMatches(second, displayTeam1) ||
    teamIdentityMatches(first, displayTeam2)
  ) {
    left = second;
    right = first;
  }

  /* Поддержка старых локальных данных teamScore/opponentScore. */
  const hasDatabaseTeams = Boolean(
    first.id ||
    first.name ||
    second.id ||
    second.name ||
    map.team1 ||
    map.team2 ||
    map.team1_score !== undefined ||
    map.team2_score !== undefined
  );

  const teamScore = hasDatabaseTeams
    ? left.score
    : toNumber(map.teamScore);

  const opponentScore = hasDatabaseTeams
    ? right.score
    : toNumber(map.opponentScore);

  return {
    ...map,
    map:
      map.map ||
      map.map_name ||
      map.mapName ||
      "Unknown",
    teamScore,
    opponentScore,
    team1: {
      id: left.id || displayTeam1?.id || null,
      name: left.name || displayTeam1?.name || "Team 1",
      score: teamScore,
    },
    team2: {
      id: right.id || displayTeam2?.id || null,
      name: right.name || displayTeam2?.name || "Team 2",
      score: opponentScore,
    },
    won: teamScore > opponentScore,
  };
}

function filterRecentMatches(matches) {
  const threeMonthsAgo = new Date();

  threeMonthsAgo.setMonth(
    threeMonthsAgo.getMonth() - 3
  );

  return matches
    .filter(
      (item) =>
        new Date(item.date) >= threeMonthsAgo
    )
    .sort(
      (first, second) =>
        new Date(second.date) -
        new Date(first.date)
    );
}

function getCountryFlagUrl(countryCode) {
  return countryCode && countryCode.length === 2
    ? `https://flagcdn.com/w640/${countryCode.toLowerCase()}.png`
    : null;
}

function TeamHero({
  team,
}) {
  const localTeam = findLocalTeam(team?.id, team?.name);

  const navigationSlug =
    localTeam?.slug ||
    team?.slug ||
    null;

  const name = localTeam?.name || team.name;
  const logo = localTeam?.logo || team.logo;

  const panel = (
    <div className="group relative z-10 flex h-full flex-col items-center justify-center gap-3">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-[#243041] bg-[#0b0f14] md:h-24 md:w-24">
        {logo ? (
          <img
            src={logo}
            alt={name}
            className="h-full w-full object-contain p-2 transition group-hover:scale-[1.04]"
          />
        ) : (
          <div className="text-2xl font-black text-gray-500">
            ?
          </div>
        )}
      </div>

      <div className="min-w-0 text-center">
        <div className="truncate text-lg font-bold transition-colors group-hover:text-orange-400 md:text-xl">
          {name}
        </div>
      </div>
    </div>
  );

  if(!navigationSlug){
    return panel;
  }

  return (
    <Link
      to={`/teams/${navigationSlug}`}
      state={{from:window.location.pathname,label:"← Back to Match"}}
      className="block h-full"
    >
      {panel}
    </Link>
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
              to={`/match/${item.matchId}`}
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


const MAP_ORDER = [
  "Mirage",
  "Inferno",
  "Nuke",
  "Ancient",
  "Anubis",
  "Dust2",
  "Train",
  "Cache",
  "Vertigo",
];

function getTeamMapStatistics(team) {
  if (!team?.slug) {
    return new Map();
  }

  const statsByMap = new Map();

  matchesData
    .filter((item) => item.teamSlug === team.slug)
    .forEach((item) => {
      const maps = Array.isArray(item.mapScores)
        ? item.mapScores
        : [];

      maps.forEach((map) => {
        const mapName = formatMapName(map.map);
        const current = statsByMap.get(mapName) || {
          wins: 0,
          losses: 0,
        };

        const teamScore = toNumber(map.teamScore);
        const opponentScore = toNumber(map.opponentScore);
        const won =
          typeof map.won === "boolean"
            ? map.won
            : teamScore > opponentScore;

        if (won) {
          current.wins += 1;
        } else {
          current.losses += 1;
        }

        statsByMap.set(mapName, current);
      });
    });

  return statsByMap;
}

function getMapWinrate(record) {
  const played = record.wins + record.losses;

  return played > 0
    ? Math.round((record.wins / played) * 100)
    : 0;
}

function MapStatisticsCard({
  leftTeam,
  rightTeam,
  leftLocalTeam,
  rightLocalTeam,
}) {
  const leftStats = useMemo(
    () => getTeamMapStatistics(leftLocalTeam),
    [leftLocalTeam]
  );

  const rightStats = useMemo(
    () => getTeamMapStatistics(rightLocalTeam),
    [rightLocalTeam]
  );

  const maps = useMemo(() => {
    const availableMaps = new Set([
      ...leftStats.keys(),
      ...rightStats.keys(),
    ]);

    return [...availableMaps]
      .sort((first, second) => {
        const firstIndex = MAP_ORDER.indexOf(first);
        const secondIndex = MAP_ORDER.indexOf(second);

        if (firstIndex === -1 && secondIndex === -1) {
          return first.localeCompare(second);
        }

        if (firstIndex === -1) return 1;
        if (secondIndex === -1) return -1;

        return firstIndex - secondIndex;
      })
      .slice(0, 7);
  }, [leftStats, rightStats]);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#263244] bg-[#101722]">
      <div className="border-b border-[#243041] px-5 py-4">
        <h2 className="text-xl font-black">Map Statistics</h2>
        <p className="mt-1 text-xs text-gray-500">
          Historical results from tracked matches
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] gap-2 border-b border-[#243041] px-5 py-3 text-xs text-gray-500">
        <div>Map</div>
        <div className="truncate text-center">{leftTeam.name}</div>
        <div className="truncate text-center">{rightTeam.name}</div>
      </div>

      {maps.length === 0 ? (
        <div className="p-6 text-sm text-gray-500">
          Map statistics are not available yet.
        </div>
      ) : (
        <div>
          {maps.map((mapName) => {
            const left = leftStats.get(mapName) || {
              wins: 0,
              losses: 0,
            };
            const right = rightStats.get(mapName) || {
              wins: 0,
              losses: 0,
            };

            return (
              <div
                key={mapName}
                className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-2 border-b border-[#1d2634] px-5 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={`/maps/${mapName.toLowerCase()}.png`}
                    alt=""
                    className="h-10 w-14 rounded-md bg-[#0b0f14] object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />

                  <div className="truncate font-bold">{mapName}</div>
                </div>

                {[left, right].map((record, index) => (
                  <div
                    key={`${mapName}-${index}`}
                    className="text-center"
                  >
                    <div className="text-sm font-black">
                      <span className="text-green-400">{record.wins}W</span>
                      <span className="text-gray-600"> - </span>
                      <span className="text-red-400">{record.losses}L</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {getMapWinrate(record)}%
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VoteCard({ matchId, team1, team2 }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [votes, setVotes] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const team1VoteId = String(team1.id || team1.slug || team1.name);
  const team2VoteId = String(team2.id || team2.slug || team2.name);

  const loadVotes = useCallback(async () => {
    if (!supabase || !matchId) {
      setLoading(false);
      return;
    }

    try {
      const [{ data: authData }, { data, error: votesError }] =
        await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("match_votes")
            .select("team_id,user_id")
            .eq("match_id", matchId),
        ]);

      if (votesError) throw votesError;

      const currentUser = authData?.user || null;
      const loadedVotes = Array.isArray(data) ? data : [];

      setUser(currentUser);
      setVotes(loadedVotes);

      const ownVote = currentUser
        ? loadedVotes.find((vote) => vote.user_id === currentUser.id)
        : null;

      setSelectedTeamId(ownVote?.team_id ? String(ownVote.team_id) : null);
      setError("");
    } catch (loadError) {
      console.error("Failed to load match votes:", loadError);
      setError("Voting is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadVotes();
  }, [loadVotes]);

  const voteFor = async (teamId) => {
    if (!user || selectedTeamId || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const { error: insertError } = await supabase
        .from("match_votes")
        .insert({
          match_id: matchId,
          user_id: user.id,
          team_id: teamId,
        });

      if (insertError) throw insertError;

      setSelectedTeamId(teamId);
      setVotes((current) => [
        ...current,
        { team_id: teamId, user_id: user.id },
      ]);
    } catch (voteError) {
      console.error("Failed to submit vote:", voteError);
      setError("Could not save your vote. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const team1Votes = votes.filter(
    (vote) => String(vote.team_id) === team1VoteId
  ).length;
  const team2Votes = votes.filter(
    (vote) => String(vote.team_id) === team2VoteId
  ).length;
  const totalVotes = team1Votes + team2Votes;
  const team1Percent = totalVotes
    ? Math.round((team1Votes / totalVotes) * 100)
    : 50;
  const team2Percent = 100 - team1Percent;
  const hasVoted = Boolean(selectedTeamId);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#263244] bg-[#101722]">
      <div className="border-b border-[#243041] px-5 py-4">
        <h2 className="text-xl font-black">Vote for Winner</h2>
        <p className="mt-1 text-xs text-gray-500">
          Community prediction
        </p>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          {[team1, team2].map((team, index) => (
            <div key={String(team.id || team.name)} className={index ? "col-start-3" : ""}>
              {team.logo ? (
                <img
                  src={team.logo}
                  alt={team.name}
                  className="mx-auto h-16 w-16 rounded-lg bg-[#0b0f14] object-contain p-2"
                />
              ) : (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-[#0b0f14] text-xl font-black text-gray-500">
                  ?
                </div>
              )}
              <div className="mt-2 truncate font-bold">{team.name}</div>
            </div>
          ))}
          <div className="col-start-2 row-start-1 font-black text-gray-400">VS</div>
        </div>

        {loading ? (
          <div className="mt-7 text-center text-sm text-gray-500">
            Loading votes...
          </div>
        ) : (
          <>
            {!hasVoted && user && !error && (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => voteFor(team1VoteId)}
                  className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-3 text-sm font-bold text-orange-400 transition hover:bg-orange-500 hover:text-white disabled:cursor-wait disabled:opacity-50"
                >
                  Vote {team1.name}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => voteFor(team2VoteId)}
                  className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-3 text-sm font-bold text-orange-400 transition hover:bg-orange-500 hover:text-white disabled:cursor-wait disabled:opacity-50"
                >
                  Vote {team2.name}
                </button>
              </div>
            )}

            <div className="mt-6 overflow-hidden rounded-xl bg-[#202938]">
              <div className="flex h-12 font-black">
                <div
                  className="flex items-center bg-orange-500 px-4 text-white transition-all"
                  style={{ width: `${team1Percent}%` }}
                >
                  {team1Percent}%
                </div>
                <div
                  className="flex items-center justify-end px-4 text-white transition-all"
                  style={{ width: `${team2Percent}%` }}
                >
                  {team2Percent}%
                </div>
              </div>
            </div>

            <div className="mt-3 text-center text-sm text-gray-400">
              {totalVotes.toLocaleString("ru-RU")} votes
            </div>

            {!user && !error && (
  <div className="mt-5 rounded-xl border border-[#243041] bg-[#0b0f14] p-3 text-center text-sm text-gray-400">
    <Link
      to="/login"
      state={{ from: location }}
      className="font-semibold text-orange-400 transition-colors hover:text-orange-300 hover:underline"
    >
      Log in
    </Link>{" "}
    to vote
  </div>
)}

            {hasVoted && (
              <div className="mt-5 text-center text-sm font-semibold text-green-400">
                ✓ Thanks for voting
              </div>
            )}

            {error && (
              <div className="mt-5 text-center text-sm text-yellow-400">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function MatchInformationCard({
  team1,
  team2,
  season,
  date,
  bestOf,
  faceitUrl,
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-[#263244] bg-[#101722]">
      <div className="border-b border-[#243041] px-5 py-4">
        <h2 className="text-xl font-black">Match Information</h2>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <div className="text-sm text-gray-500">Teams</div>
          <div className="font-bold">{team1.name} vs {team2.name}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">League</div>
          <div className="font-bold">
            <TournamentNameLink name={season} />
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Match Date</div>
          <div className="font-bold">{formatDateTime(date)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Format</div>
          <div className="font-bold">BO{bestOf}</div>
        </div>

        <a
          href={faceitUrl}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center rounded-xl bg-orange-500 px-5 py-3 font-bold transition hover:bg-orange-600"
        >
          Open FACEIT Match Room →
        </a>
      </div>
    </section>
  );
}


function getRatingPoints(row) {
  return toNumber(row?.points ?? row?.rating, 0);
}

function getRatingMatchesPlayed(row) {
  return toNumber(
    row?.rating_matches_played ?? row?.matches_played,
    0
  );
}

function getTeamLookupCandidates(team) {
  const localTeam = findLocalTeam(
    team?.id,
    team?.name
  );

  return {
    ids: new Set(
      [
        team?.id,
        team?.teamId,
        team?.faceitTeamId,
        team?.faceit_team_id,
        localTeam?.id,
        localTeam?.teamId,
        localTeam?.faceitTeamId,
        localTeam?.faceit_team_id,
      ]
        .filter(Boolean)
        .map((value) => String(value))
    ),
    slugs: new Set(
      [
        team?.slug,
        localTeam?.slug,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
    ),
    names: new Set(
      [
        team?.name,
        localTeam?.name,
      ]
        .filter(Boolean)
        .map(normalizeName)
    ),
  };
}

function findTeamRating(rows, team) {
  if (!Array.isArray(rows) || !team) {
    return null;
  }

  const candidates =
    getTeamLookupCandidates(team);

  return (
    rows.find((row) => {
      const rowIds = [
        row.team_id,
        row.faceit_team_id,
        row.faceitTeamId,
        row.id,
      ]
        .filter(Boolean)
        .map((value) => String(value));

      const rowSlugs = [
        row.team_slug,
        row.slug,
      ]
        .filter(Boolean)
        .map((value) =>
          String(value).toLowerCase()
        );

      const rowNames = [
        row.team_name,
        row.name,
      ]
        .filter(Boolean)
        .map(normalizeName);

      return (
        rowIds.some((id) =>
          candidates.ids.has(id)
        ) ||
        rowSlugs.some((slug) =>
          candidates.slugs.has(slug)
        ) ||
        rowNames.some((name) =>
          candidates.names.has(name)
        )
      );
    }) || null
  );
}

function getForecastSeriesScore(bestOf) {
  const bo = Math.max(1, toNumber(bestOf, 1));
  const winnerScore = Math.floor(bo / 2) + 1;
  return {
    winnerScore,
    loserScore: Math.max(0, winnerScore - 1),
  };
}

function buildRankMap(rows, replacements = new Map()) {
  const ranked = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const key = String(
        row.team_id ?? row.faceit_team_id ?? row.id ??
        row.team_slug ?? row.slug ?? row.team_name ?? row.name ?? ""
      );

      return {
        row,
        key,
        points: replacements.has(key)
          ? replacements.get(key)
          : getRatingPoints(row),
      };
    })
    .filter((item) => getRatingMatchesPlayed(item.row) >= 3)
    .sort((first, second) =>
      second.points - first.points ||
      getRatingMatchesPlayed(second.row) -
        getRatingMatchesPlayed(first.row)
    );

  return new Map(
    ranked.map((item, index) => [item.key, index + 1])
  );
}

function getRatingRowKey(row) {
  return String(
    row?.team_id ?? row?.faceit_team_id ?? row?.id ??
    row?.team_slug ?? row?.slug ?? row?.team_name ?? row?.name ?? ""
  );
}

function RatingForecastCard({
  ratingRows,
  team1,
  team2,
  season,
  bestOf,
  loading,
}) {
  const forecast = useMemo(() => {
    const team1Row =
      findTeamRating(ratingRows, team1);

    const team2Row =
      findTeamRating(ratingRows, team2);

    const team1Points = team1Row
      ? getRatingPoints(team1Row)
      : null;

    const team2Points = team2Row
      ? getRatingPoints(team2Row)
      : null;

    const team1Available =
      Boolean(team1Row) &&
      Number.isFinite(team1Points) &&
      team1Points > 0;

    const team2Available =
      Boolean(team2Row) &&
      Number.isFinite(team2Points) &&
      team2Points > 0;

    const currentRanks =
      buildRankMap(ratingRows);

    const baseResult = {
      team1: {
        available: team1Available,
        points: team1Available
          ? team1Points
          : null,
        rank: team1Available
          ? currentRanks.get(
              getRatingRowKey(team1Row)
            ) || null
          : null,
        winPoints: null,
        winChange: null,
        winRank: null,
        lossPoints: null,
        lossChange: null,
        lossRank: null,
      },
      team2: {
        available: team2Available,
        points: team2Available
          ? team2Points
          : null,
        rank: team2Available
          ? currentRanks.get(
              getRatingRowKey(team2Row)
            ) || null
          : null,
        winPoints: null,
        winChange: null,
        winRank: null,
        lossPoints: null,
        lossChange: null,
        lossRank: null,
      },
      calculable:
        team1Available && team2Available,
    };

    if (!baseResult.calculable) {
      return baseResult;
    }

    const division = normalizeDivisionName(
      team1Row.division ||
      team2Row.division ||
      season
    );

    const { winnerScore, loserScore } =
      getForecastSeriesScore(bestOf);

    const team1Wins = calculateMatchRating({
      winnerPoints: team1Points,
      loserPoints: team2Points,
      winnerScore,
      loserScore,
      division,
      region: season,
      winnerMatchesPlayed:
        getRatingMatchesPlayed(team1Row),
      loserMatchesPlayed:
        getRatingMatchesPlayed(team2Row),
    });

    const team2Wins = calculateMatchRating({
      winnerPoints: team2Points,
      loserPoints: team1Points,
      winnerScore,
      loserScore,
      division,
      region: season,
      winnerMatchesPlayed:
        getRatingMatchesPlayed(team2Row),
      loserMatchesPlayed:
        getRatingMatchesPlayed(team1Row),
    });

    const team1Key =
      getRatingRowKey(team1Row);

    const team2Key =
      getRatingRowKey(team2Row);

    const team1WinRanks = buildRankMap(
      ratingRows,
      new Map([
        [team1Key, team1Wins.winnerNewPoints],
        [team2Key, team1Wins.loserNewPoints],
      ])
    );

    const team2WinRanks = buildRankMap(
      ratingRows,
      new Map([
        [team1Key, team2Wins.loserNewPoints],
        [team2Key, team2Wins.winnerNewPoints],
      ])
    );

    return {
      calculable: true,
      team1: {
        ...baseResult.team1,
        winPoints:
          team1Wins.winnerNewPoints,
        winChange:
          team1Wins.winnerChange,
        winRank:
          team1WinRanks.get(team1Key) || null,
        lossPoints:
          team2Wins.loserNewPoints,
        lossChange:
          team2Wins.loserChange,
        lossRank:
          team2WinRanks.get(team1Key) || null,
      },
      team2: {
        ...baseResult.team2,
        winPoints:
          team2Wins.winnerNewPoints,
        winChange:
          team2Wins.winnerChange,
        winRank:
          team2WinRanks.get(team2Key) || null,
        lossPoints:
          team1Wins.loserNewPoints,
        lossChange:
          team1Wins.loserChange,
        lossRank:
          team1WinRanks.get(team2Key) || null,
      },
    };
  }, [
    ratingRows,
    team1,
    team2,
    season,
    bestOf,
  ]);

  const rows = [
    {
      team: team1,
      data: forecast?.team1,
    },
    {
      team: team2,
      data: forecast?.team2,
    },
  ];

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#263244] bg-[#101722]">
      <div className="border-b border-[#263244] px-5 py-4 sm:px-6">
        <h2 className="text-xl font-black">
          Rating forecast
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          How this match can change the team ranking
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[minmax(180px,1fr)_110px_150px_150px] border-b border-[#263244] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-6">
            <div>Team</div>
            <div className="text-center">Current</div>
            <div className="text-center">If team wins</div>
            <div className="text-center">If team loses</div>
          </div>

          {rows.map(({ team, data }) => (
            <div
              key={String(
                team.id ||
                team.slug ||
                team.name
              )}
              className="grid grid-cols-[minmax(180px,1fr)_110px_150px_150px] items-center border-b border-[#222e3f] px-5 py-4 last:border-0 sm:px-6"
            >
              <div className="flex min-w-0 items-center gap-3">
                {team.logo ? (
                  <img
                    src={team.logo}
                    alt=""
                    className="h-9 w-9 shrink-0 object-contain"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0b0f14] text-xs font-black text-slate-600">
                    ?
                  </div>
                )}

                <div className="truncate font-bold text-white">
                  {team.name}
                </div>
              </div>

              {loading ? (
                <>
                  <div className="text-center text-sm text-slate-600">
                    …
                  </div>
                  <div className="text-center text-sm text-slate-600">
                    …
                  </div>
                  <div className="text-center text-sm text-slate-600">
                    …
                  </div>
                </>
              ) : data?.available ? (
                <>
                  <div className="text-center">
                    <div className="font-black text-slate-200">
                      {data.points} pt
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {data.rank
                        ? `#${data.rank}`
                        : "Unranked"}
                    </div>
                  </div>

                  <div className="text-center">
                    {forecast?.calculable ? (
                      <>
                        <div className="font-black text-emerald-400">
                          {data.winPoints} pt
                        </div>
                        <div className="mt-1 text-xs font-bold text-emerald-400">
                          {data.winChange > 0 ? "+" : ""}
                          {data.winChange}
                          {data.winRank
                            ? ` · #${data.winRank}`
                            : ""}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs font-semibold text-slate-600">
                        Unavailable
                      </div>
                    )}
                  </div>

                  <div className="text-center">
                    {forecast?.calculable ? (
                      <>
                        <div className="font-black text-rose-400">
                          {data.lossPoints} pt
                        </div>
                        <div className="mt-1 text-xs font-bold text-rose-400">
                          {data.lossChange > 0 ? "+" : ""}
                          {data.lossChange}
                          {data.lossRank
                            ? ` · #${data.lossRank}`
                            : ""}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs font-semibold text-slate-600">
                        Unavailable
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center text-xs font-semibold text-slate-500">
                    Unrated
                  </div>
                  <div className="text-center text-xs font-semibold text-slate-600">
                    Unavailable
                  </div>
                  <div className="text-center text-xs font-semibold text-slate-600">
                    Unavailable
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function FinishedMatchHero({
  team1,
  team2,
  score,
  season,
  bestOf,
  date,
  maps,
  isLive,
  team1FlagUrl,
  team2FlagUrl,
}) {
  const [team1Score, team2Score] = String(score)
    .split(":")
    .map((value) => toNumber(value.trim()));

  const team1Won =
    !isLive && team1Score > team2Score;

  const team2Won =
    !isLive && team2Score > team1Score;

  return (
    <section className="relative mt-5 overflow-hidden rounded-[30px] border border-[#263244] bg-[#0f1620] shadow-2xl shadow-black/20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 -top-32 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute -right-28 -bottom-36 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {team1FlagUrl && (
          <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
            <img
              src={team1FlagUrl}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover opacity-40 blur-[2px]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f1620]/10 via-[#0f1620]/70 to-[#0f1620]" />
          </div>
        )}

        {team2FlagUrl && (
          <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
            <img
              src={team2FlagUrl}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover opacity-40 blur-[2px]"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-[#0f1620]/10 via-[#0f1620]/70 to-[#0f1620]" />
          </div>
        )}
      </div>

      <div className="relative">
        <div className="p-6 md:p-9 lg:p-11">
          <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
            <span className="rounded-full border border-[#2a3546] bg-[#151e2a] px-4 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-slate-300">
              BO{bestOf}
            </span>

            
          </div>

          <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_190px_minmax(0,1fr)]">
            <div className="relative">
              {team1Won && (
                <div className="mb-3 text-center text-xs font-black uppercase tracking-[0.22em] text-emerald-400 md:text-left">
                  Winner
                </div>
              )}
              <TeamHero team={team1} />
            </div>

            <div className="text-center">
              <div className="text-5xl font-black tracking-[-0.07em] text-white sm:text-6xl">
                {score}
              </div>
              <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Series score
              </div>
            </div>

            <div className="relative">
              {team2Won && (
                <div className="mb-3 text-center text-xs font-black uppercase tracking-[0.22em] text-emerald-400 md:text-right">
                  Winner
                </div>
              )}
              <TeamHero team={team2} align="right" />
            </div>
          </div>

          <div className="mt-9">
            <div className="text-center">
              <div className="font-bold text-slate-300">
                <TournamentNameLink name={season} />
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {formatDateTime(date)}
              </div>
            </div>

            {Array.isArray(maps) && maps.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {maps.map((map, index) => (
                  <div
                    key={`${map.map}-${index}`}
                    className="flex items-center gap-2 rounded-xl border border-[#263244] bg-[#0b1119] px-3 py-2"
                  >
                    <span className="text-sm font-bold text-slate-300">
                      {formatMapName(map.map)}
                    </span>
                    <span
                      className={`text-sm font-black ${
                        map.won
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {toNumber(map.teamScore)}:{toNumber(map.opponentScore)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveMatchPage() {
  const location = useLocation();

  const {
    slug: routeSlug,
    matchId: routeMatchId,
    id: routeId,
  } = useParams();

  /*
   * Поддержка обоих вариантов маршрута:
   * /match/:id и /match/:matchId
   */
  const matchId = routeMatchId || routeId || "";

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

  const [ratingRows, setRatingRows] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;

    async function loadTeamRatings() {
      if (!supabase) {
        setRatingsLoading(false);
        return;
      }

      try {
        // PostgREST caps an unbounded select() at 1000 rows — with 1092+
        // teams in team_ratings, that silently dropped whichever ~90 rows
        // sorted last, no error surfaced. Page via .range() instead.
        const PAGE_SIZE = 1000;
        const allRows = [];

        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error } = await supabase
            .from("team_ratings")
            .select("*")
            .range(from, from + PAGE_SIZE - 1);

          if (error) throw error;

          const page = Array.isArray(data) ? data : [];
          allRows.push(...page);

          if (page.length < PAGE_SIZE) break;
        }

        if (!cancelled) {
          setRatingRows(allRows);
        }
      } catch (error) {
        console.warn("Rating forecast unavailable:", error.message);
        if (!cancelled) setRatingRows([]);
      } finally {
        if (!cancelled) setRatingsLoading(false);
      }
    }

    loadTeamRatings();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const team1FlagUrl = getCountryFlagUrl(
    leftLocalTeam?.country ||
      displayTeam1?.country ||
      displayTeam1?.countryCode
  );

  const team2FlagUrl = getCountryFlagUrl(
    rightLocalTeam?.country ||
      displayTeam2?.country ||
      displayTeam2?.countryCode
  );

  const leftFallbackMatches = matchesData.filter(
    (match) => match.teamSlug === leftLocalTeam?.slug
  );

  const rightFallbackMatches = matchesData.filter(
    (match) => match.teamSlug === rightLocalTeam?.slug
  );

  const { matches: leftAllMatches = [] } = useTeamStats(
    leftLocalTeam?.slug,
    leftFallbackMatches
  );

  const { matches: rightAllMatches = [] } = useTeamStats(
    rightLocalTeam?.slug,
    rightFallbackMatches
  );

  const leftRecentMatches = filterRecentMatches(leftAllMatches);

  const rightRecentMatches = filterRecentMatches(rightAllMatches);

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
    Array.isArray(liveData?.mapScores)
      ? liveData.mapScores
          .map((map) =>
            normalizeDisplayedMapScore(
              map,
              displayTeam1,
              displayTeam2
            )
          )
          .filter(Boolean)
      : [];

  const displayedMapScores =
    databaseMapScores.length > 0
      ? databaseMapScores
      : (Array.isArray(finishedMatch?.mapScores)
          ? finishedMatch.mapScores
              .map((map) =>
                normalizeDisplayedMapScore(
                  map,
                  displayTeam1,
                  displayTeam2
                )
              )
              .filter(Boolean)
          : []);

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
   * H2H строится из тех же live-подгруженных
   * матчей (useTeamStats), что и Recent Matches,
   * только если обе команды есть в локальном рейтинге.
   */
  const h2hMatches =
    leftLocalTeam &&
    rightLocalTeam
      ? [
          ...leftAllMatches.filter(
            (item) =>
              normalizeName(item.opponentName) ===
              normalizeName(rightLocalTeam.name)
          ),
          ...rightAllMatches.filter(
            (item) =>
              normalizeName(item.opponentName) ===
              normalizeName(leftLocalTeam.name)
          ),
        ]
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

  const showFinishedSections =
    Boolean(finishedMatch) ||
    apiSaysFinished;

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

  return (
    <div className="min-h-screen bg-[#090f16] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[900px]">
        <div className="flex items-center justify-between gap-4">
          <Link
            to={
              navigationSlug
                ? `/teams/${navigationSlug}/matches`
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

        {showFinishedSections || isLive ? (
          <FinishedMatchHero
            team1={displayTeam1}
            team2={displayTeam2}
            score={displayScore}
            season={displaySeason}
            bestOf={displayBestOf}
            date={displayDate}
            maps={displayedMapScores}
            stats={stats}
            isLive={isLive}
            team1FlagUrl={team1FlagUrl}
            team2FlagUrl={team2FlagUrl}
          />
        ) : (
          <div className="relative mt-5 overflow-hidden rounded-[30px] border border-[#263244] bg-[#101722] shadow-2xl shadow-black/20">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {team1FlagUrl && (
                <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                  <img
                    src={team1FlagUrl}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover opacity-40 blur-[2px]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#101722]/10 via-[#101722]/70 to-[#101722]" />
                </div>
              )}

              {team2FlagUrl && (
                <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
                  <img
                    src={team2FlagUrl}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover opacity-40 blur-[2px]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-[#101722]/10 via-[#101722]/70 to-[#101722]" />
                </div>
              )}
            </div>
            <div className="relative p-6 md:p-10 lg:p-12">
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px_minmax(0,1fr)] lg:items-stretch">
                <TeamHero team={displayTeam1} />

                <div className="flex flex-col items-center justify-center text-center">
                  <div className="mb-5 inline-flex rounded-full border border-orange-500/25 bg-orange-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-orange-300">
                    BO{displayBestOf}
                  </div>

                  <div className="text-5xl font-black tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
                    {formatMatchTime(displayDate)}
                  </div>

                  <div className="mt-4 text-gray-400">
                    <TournamentNameLink name={displaySeason} />
                  </div>

                  <div className="mt-1 text-sm text-gray-500">
                    {formatMatchDate(displayDate)}
                  </div>
                </div>

                <TeamHero team={displayTeam2} />
              </div>
            </div>
          </div>
        )}

        {/* MAPS */}

        {(showFinishedSections || isLive) && (
          <div className="mt-8">
            <MatchMapResultsSection
              matchId={matchId}
              maps={displayedMapScores}
              team1={displayTeam1}
              team2={displayTeam2}
            />
          </div>
        )}

        {!showFinishedSections && (
          <div className="mt-8">
            <MatchLineups team1={displayTeam1} team2={displayTeam2} />
          </div>
        )}

        {!showFinishedSections && !isLive && (
          <div className="mt-8">
            <RatingForecastCard
              ratingRows={ratingRows}
              team1={displayTeam1}
              team2={displayTeam2}
              season={displaySeason}
              bestOf={displayBestOf}
              loading={ratingsLoading}
            />
          </div>
        )}

        {!showFinishedSections && !isLive && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
            <div className="space-y-6">
              <MapStatisticsCard
                leftTeam={displayTeam1}
                rightTeam={displayTeam2}
                leftLocalTeam={leftLocalTeam}
                rightLocalTeam={rightLocalTeam}
              />
            </div>

            <div className="space-y-6">
            <VoteCard
              matchId={matchId}
              team1={displayTeam1}
              team2={displayTeam2}
            />

            <MatchInformationCard
              team1={displayTeam1}
              team2={displayTeam2}
              season={displaySeason}
              date={displayDate}
              bestOf={displayBestOf}
              faceitUrl={displayFaceitUrl}
            />
            </div>
          </div>
        )}

        {/* PLAYER STATISTICS */}

        {showFinishedSections &&
          Array.isArray(
            stats?.teams
          ) &&
          stats.teams.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 text-2xl font-black tracking-tight">
                Player Statistics
              </h2>

              <div className="space-y-6">
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
                        className="overflow-hidden rounded-[24px] border border-[#263244] bg-[#101722]"
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
                                            to={`/player/${encodeURIComponent(
                                              player.playerId ||
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
          <div className="mt-8">
            <h2 className="mb-4 text-2xl font-black tracking-tight">
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
            <HeadToHeadCard
              matches={uniqueH2HMatches}
              team1={displayTeam1}
              team2={displayTeam2}
              leftTeamSlug={leftLocalTeam.slug}
            />
          )}

        {/* MATCH INFORMATION */}

        {(showFinishedSections || isLive) && (
        <div className="mt-8">
          <h2 className="mb-4 text-2xl font-black tracking-tight">
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
                  <TournamentNameLink name={displaySeason} />
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
        )}

        <MatchComments matchId={matchId} />
      </div>
    </div>
  );
}

export default LiveMatchPage;