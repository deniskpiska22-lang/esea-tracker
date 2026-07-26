import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import upcomingMatches from "../data/upcomingMatches";
import matchesData from "../data/matches";
import teams from "../data/teams";
import tournaments from "../data/tournaments";
import { supabase } from "../lib/supabaseClient";
import { getTournamentStatus } from "../utils/tournaments";
import TournamentNameLink from "../components/TournamentNameLink";


const LIVE_STATUSES = new Set([
  "LIVE",
  "READY",
  "STARTED",
  "ONGOING",
  "IN_PROGRESS",
  "RUNNING",
  // VOTING (map veto) / CONFIGURING (server setup) — FACEIT states between
  // READY and ONGOING. The match room is already active at this point
  // (players in, veto happening), so it should read as live, not scheduled.
  "VOTING",
  "CONFIGURING",
  "MATCH_STATUS_READY",
  "MATCH_STATUS_LIVE",
  "MATCH_STATUS_STARTED",
  "MATCH_STATUS_ONGOING",
  "MATCH_STATUS_VOTING",
  "MATCH_STATUS_CONFIGURING",
]);

const FINISHED_STATUSES = new Set([
  "FINISHED",
  "MATCH_STATUS_FINISHED",
]);

const UPCOMING_WINDOW_HOURS = 24;
const RESULTS_LIMIT = 12;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeName(value = "") {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function normalizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9а-яё-]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getRatingRowSlug(row) {
  return row?.team_slug ?? row?.slug ?? row?.teamSlug ?? "";
}

function getRatingRowId(row) {
  return (
    row?.team_id ??
    row?.teamId ??
    row?.faceit_team_id ??
    row?.faceitTeamId ??
    row?.id ??
    null
  );
}

function getRatingRowName(row) {
  return row?.team_name ?? row?.name ?? row?.teamName ?? "";
}

function getRatingValue(row) {
  const value =
    row?.points ??
    row?.rating ??
    row?.current_rating ??
    row?.currentRating ??
    row?.elo ??
    row?.score;

  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function getPointsChange(row) {
  const value =
    row?.points_change ??
    row?.rating_change ??
    row?.pointsChange ??
    row?.ratingChange;

  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function getRankChange(row) {
  const value =
    row?.rank_change ??
    row?.position_change ??
    row?.rankChange ??
    row?.positionChange;

  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function getRatingTeamLogo(staticTeam, ratingRow) {
  return normalizeLogoUrl(
    staticTeam?.logo ??
      staticTeam?.logoUrl ??
      staticTeam?.logo_url ??
      staticTeam?.avatar ??
      ratingRow?.logo ??
      ratingRow?.logo_url ??
      null
  );
}

function mergeRatingTeams(ratingRows) {
  const bySlug = new Map();
  const byId = new Map();
  const byName = new Map();

  for (const team of teams) {
    const slug = normalizeSlug(team?.slug);
    const id = String(
      team?.id ??
        team?.teamId ??
        team?.faceitTeamId ??
        team?.faceit_team_id ??
        ""
    ).trim();
    const name = normalizeName(team?.name);

    if (slug) bySlug.set(slug, team);
    if (id) byId.set(id, team);
    if (name) byName.set(name, team);
  }

  return (Array.isArray(ratingRows) ? ratingRows : [])
    .map((ratingRow) => {
      const ratingSlug = normalizeSlug(getRatingRowSlug(ratingRow));
      const ratingId = String(getRatingRowId(ratingRow) ?? "").trim();
      const ratingName = normalizeName(getRatingRowName(ratingRow));

      const staticTeam =
        bySlug.get(ratingSlug) ??
        byId.get(ratingId) ??
        byName.get(ratingName) ??
        null;

      const name =
        staticTeam?.name ||
        getRatingRowName(ratingRow) ||
        "Unknown team";

      const slug =
        staticTeam?.slug ||
        getRatingRowSlug(ratingRow) ||
        normalizeSlug(name);

      const points = getRatingValue(ratingRow);
      if (points === null || !slug) return null;

      return {
        id:
          getRatingRowId(ratingRow) ??
          staticTeam?.id ??
          staticTeam?.faceitTeamId ??
          slug,
        name,
        slug,
        logo: getRatingTeamLogo(staticTeam, ratingRow),
        division:
          staticTeam?.division ??
          ratingRow?.division ??
          ratingRow?.league_division ??
          null,
        points,
        pointsChange: getPointsChange(ratingRow),
        rankChange: getRankChange(ratingRow),
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      const pointsDifference = second.points - first.points;
      if (pointsDifference !== 0) return pointsDifference;

      return String(first.name).localeCompare(String(second.name), "en");
    })
    .map((team, index) => ({
      ...team,
      rank: index + 1,
    }));
}

function applyRatingToTeam(team, rankedTeams) {
  if (!team) return team;

  const teamId = String(
    team.id ??
      team.faceitTeamId ??
      team.faceit_team_id ??
      ""
  ).trim();

  const teamSlug = normalizeSlug(team.slug);
  const teamName = normalizeName(team.name);

  const ratingTeam =
    rankedTeams.find((item) => {
      const itemId = String(
        item.id ??
          item.faceitTeamId ??
          item.faceit_team_id ??
          ""
      ).trim();

      return (
        (teamId && itemId && teamId === itemId) ||
        (teamSlug && normalizeSlug(item.slug) === teamSlug) ||
        (teamName && normalizeName(item.name) === teamName)
      );
    }) || null;

  if (!ratingTeam) {
    return {
      ...team,
      rank: team.rank ?? null,
      points: toNumber(team.points, 0),
    };
  }

  return {
    ...team,
    rank: ratingTeam.rank,
    points: ratingTeam.points,
    pointsChange: ratingTeam.pointsChange,
    rankChange: ratingTeam.rankChange,
  };
}


function normalizeLogoUrl(value) {
  if (!value || typeof value !== "string") return null;

  const url = value.trim();
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return url.replace("http://", "https://");

  return url;
}

function findTeamByName(name) {
  if (!name) return null;

  return (
    teams.find(
      (team) => normalizeName(team.name) === normalizeName(name)
    ) || null
  );
}

function findTeamById(faceitTeamId) {
  if (!faceitTeamId) return null;

  return (
    teams.find(
      (team) =>
        String(team.faceitTeamId || "") === String(faceitTeamId)
    ) || null
  );
}

function normalizeTeam(team) {
  if (!team) {
    return {
      id: null,
      name: "TBD",
      slug: null,
      logo: null,
      points: 0,
      division: null,
      rank: null,
    };
  }

  const localTeam =
    findTeamById(team.id || team.faceitTeamId) ||
    findTeamByName(team.name);

  return {
    id:
      team.id ||
      team.faceitTeamId ||
      localTeam?.faceitTeamId ||
      null,
    name: localTeam?.name || team.name || "TBD",
    slug: localTeam?.slug || team.slug || null,
    logo: normalizeLogoUrl(localTeam?.logo || team.logo),
    points: toNumber(localTeam?.points ?? team.points),
    division: localTeam?.division || team.division || null,
    rank: localTeam?.rank ?? team.rank ?? null,
  };
}

function isLiveStatus(status = "") {
  return LIVE_STATUSES.has(String(status).toUpperCase());
}

function isFinishedStatus(status = "") {
  return FINISHED_STATUSES.has(String(status).toUpperCase());
}

function isWithinUpcomingWindow(value) {
  if (!value) return false;

  const scheduled = new Date(value).getTime();
  if (Number.isNaN(scheduled)) return false;

  const now = Date.now();
  const end = now + UPCOMING_WINDOW_HOURS * 60 * 60 * 1000;

  return scheduled >= now && scheduled <= end;
}

function formatTime(value) {
  if (!value) return "TBD";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatRelative(value) {
  if (!value) return "";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return formatDate(value);

  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return formatDate(value);
}

function formatCountdown(value) {
  if (!value) return "Soon";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Soon";

  const diff = timestamp - Date.now();
  if (diff <= 0) return "Starting";

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function getLeaguePriority(season = "") {
  const value = String(season).toLowerCase();

  if (value.includes("ecl") || value.includes("finals")) return 700;
  if (value.includes("advanced") && value.includes("playoff")) return 650;
  if (value.includes("advanced")) return 600;
  if (value.includes("main") && value.includes("playoff")) return 550;
  if (value.includes("main")) return 500;
  if (value.includes("intermediate") && value.includes("playoff")) return 450;
  if (value.includes("intermediate")) return 400;
  if (value.includes("entry") && value.includes("playoff")) return 350;
  if (value.includes("entry")) return 300;
  if (value.includes("playoff")) return 250;

  return 100;
}

function getMatchImportance(match) {
  const league =
    match.season ||
    match.championshipName ||
    "";

  const leagueScore = getLeaguePriority(league) * 100000;
  const teamStrength =
    toNumber(match.team1?.points) +
    toNumber(match.team2?.points);

  const liveBonus = isLiveStatus(match.status) ? 10000000 : 0;
  const scheduled = new Date(match.scheduledAt).getTime();
  const timeBonus = Number.isNaN(scheduled)
    ? 0
    : Math.max(0, 86400000 - Math.abs(scheduled - Date.now())) / 1000;

  return leagueScore + teamStrength + liveBonus + timeBonus;
}

function selectFeaturedMatch(matches) {
  return (
    [...matches].sort(
      (first, second) =>
        getMatchImportance(second) - getMatchImportance(first)
    )[0] || null
  );
}

function isAutomaticWin(match) {
  if (!match) return true;

  const searchableText = [
    match.status,
    match.resultType,
    match.result_type,
    match.finishReason,
    match.finish_reason,
    match.reason,
    match.season,
    match.team1?.name,
    match.team2?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const automaticWinMarkers = [
    "auto win",
    "autowin",
    "auto-win",
    "automatic win",
    "walkover",
    "walk-over",
    "forfeit",
    "default win",
    "no show",
    "noshow",
    "w/o",
    "bye",
  ];

  if (
    automaticWinMarkers.some((marker) =>
      searchableText.includes(marker)
    )
  ) {
    return true;
  }

  const team1Name = String(match.team1?.name || "")
    .trim()
    .toLowerCase();
  const team2Name = String(match.team2?.name || "")
    .trim()
    .toLowerCase();

  if (
    !team1Name ||
    !team2Name ||
    team1Name === "tbd" ||
    team2Name === "tbd" ||
    team1Name === "bye" ||
    team2Name === "bye"
  ) {
    return true;
  }

  const team1Score = Number(match.team1?.score);
  const team2Score = Number(match.team2?.score);

  /*
   * FACEIT technical wins are not always marked as BYE/forfeit.
   * Many of them are stored as FINISHED with a 0:0 series score.
   * Such matches must never be selected for the featured result.
   */
  if (
    Number.isFinite(team1Score) &&
    Number.isFinite(team2Score) &&
    team1Score === 0 &&
    team2Score === 0
  ) {
    return true;
  }

  /*
   * Invalid or missing series scores are also excluded. A genuinely
   * completed CS2 match must have at least one positive series score.
   */
  if (
    !Number.isFinite(team1Score) ||
    !Number.isFinite(team2Score) ||
    Math.max(team1Score, team2Score) <= 0
  ) {
    return true;
  }

  return false;
}

function getCompletedMatchPopularity(match) {
  if (!match) return 0;

  const leagueScore =
    getLeaguePriority(match.season || "ESEA League") * 1_000_000;

  const teamStrength =
    (
      toNumber(match.team1?.points) +
      toNumber(match.team2?.points)
    ) * 1_000;

  const finishedAt = new Date(match.date).getTime();
  const ageInHours = Number.isNaN(finishedAt)
    ? 168
    : Math.max(0, (Date.now() - finishedAt) / 3_600_000);

  /*
   * Recent matches receive a small bonus, while league level and
   * the combined team rating remain the main popularity signals.
   */
  const recencyBonus = Math.max(0, 168 - ageInHours) * 100;

  return leagueScore + teamStrength + recencyBonus;
}

function selectPopularCompletedMatch(matches) {
  return (
    [...matches]
      .filter((match) => !isAutomaticWin(match))
      .sort(
        (first, second) =>
          getCompletedMatchPopularity(second) -
          getCompletedMatchPopularity(first)
      )[0] || null
  );
}

// raw_data.detailed_results (already stored by worker.js/autoSyncMatches.js
// on every live tick — nothing new fetched here) is FACEIT's per-map round
// breakdown, one entry per map played/in-progress. matches.team1_score is
// the *series* score (map wins once decided) and round score for a plain
// BO1, but for a live BO3 it doesn't expose the current map's round score
// at all — detailed_results is the only place that lives. Last entry is
// always "the map currently relevant" (in progress, or the final map once
// finished); comparing every entry's own faction scores gives the map-win
// tally without needing any extra data.
function getMapProgress(row) {
  const detailedResults = Array.isArray(row.raw_data?.detailed_results)
    ? row.raw_data.detailed_results
    : [];

  if (detailedResults.length === 0) {
    return null;
  }

  // The last entry is the map currently being played — its round score
  // isn't a decided result yet, so it must NOT count toward maps won
  // unless the whole match has actually finished (in which case every
  // entry, including the last, is a real, decided map).
  const isFinished = FINISHED_STATUSES.has(String(row.status || "").toUpperCase());
  const decidedMaps = isFinished
    ? detailedResults
    : detailedResults.slice(0, -1);

  let mapsWon1 = 0;
  let mapsWon2 = 0;

  for (const map of decidedMaps) {
    const s1 = Number(map?.factions?.faction1?.score ?? 0);
    const s2 = Number(map?.factions?.faction2?.score ?? 0);
    if (s1 > s2) mapsWon1 += 1;
    else if (s2 > s1) mapsWon2 += 1;
  }

  const current = detailedResults[detailedResults.length - 1];

  return {
    currentScore1: Number(current?.factions?.faction1?.score ?? 0),
    currentScore2: Number(current?.factions?.faction2?.score ?? 0),
    mapsWon1,
    mapsWon2,
  };
}

function dbRowToMatch(row) {
  return {
    id: row.id,
    matchId: row.id,
    status: row.status,
    bestOf: row.best_of,
    season: row.competition_name || "ESEA League",
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    team1Score: toNumber(row.team1_score),
    team2Score: toNumber(row.team2_score),
    mapProgress: getMapProgress(row),
    team1: normalizeTeam({
      id: row.team1_id,
      name: row.team1_name,
      slug: row.team1_slug,
      logo: row.team1_logo,
    }),
    team2: normalizeTeam({
      id: row.team2_id,
      name: row.team2_name,
      slug: row.team2_slug,
      logo: row.team2_logo,
    }),
  };
}

function dbRowToResult(row) {
  return {
    id: row.id,
    matchId: row.id,
    date: row.finished_at || row.scheduled_at,
    season: row.competition_name || "ESEA League",
    bestOf: row.best_of,
    status: row.status,
    resultType:
      row.result_type ||
      row.finish_reason ||
      row.reason ||
      null,
    finishReason:
      row.finish_reason ||
      row.reason ||
      null,
    mapScores:
      row.map_scores ||
      row.maps ||
      null,
    statsSynced: Boolean(row.stats_synced),
    team1: {
      ...normalizeTeam({
        id: row.team1_id,
        name: row.team1_name,
        slug: row.team1_slug,
        logo: row.team1_logo,
      }),
      score: row.team1_score ?? "-",
    },
    team2: {
      ...normalizeTeam({
        id: row.team2_id,
        name: row.team2_name,
        slug: row.team2_slug,
        logo: row.team2_logo,
      }),
      score: row.team2_score ?? "-",
    },
  };
}

function getStaticUpcoming() {
  return [...upcomingMatches]
    .map((match) => ({
      ...match,
      team1: normalizeTeam(match.team1),
      team2: normalizeTeam(match.team2),
    }))
    .filter(
      (match) =>
        isLiveStatus(match.status) ||
        isWithinUpcomingWindow(match.scheduledAt)
    )
    .sort(
      (first, second) =>
        new Date(first.scheduledAt) - new Date(second.scheduledAt)
    );
}

function getStaticResults(limit = RESULTS_LIMIT) {
  const unique = new Map();

  for (const match of matchesData) {
    const matchId = match.matchId || match.id;
    if (!matchId || unique.has(matchId)) continue;

    const team1 =
      teams.find((team) => team.slug === match.teamSlug) ||
      findTeamByName(match.teamName);

    const team2 = findTeamByName(match.opponentName);

    const [score1, score2] = String(match.boScore || "")
      .split(":")
      .map((value) => value.trim());

    unique.set(matchId, {
      id: matchId,
      matchId,
      date: match.date,
      season: match.season || "ESEA League",
      bestOf: match.bestOf,
      status: match.status || "FINISHED",
      resultType:
        match.resultType ||
        match.result_type ||
        match.finishReason ||
        match.finish_reason ||
        match.reason ||
        null,
      finishReason:
        match.finishReason ||
        match.finish_reason ||
        match.reason ||
        null,
      mapScores:
        match.mapScores ||
        match.map_scores ||
        match.maps ||
        null,
      team1: {
        ...normalizeTeam({
          id: team1?.faceitTeamId,
          name: team1?.name || match.teamName,
          slug: team1?.slug || match.teamSlug,
          logo: team1?.logo,
        }),
        score: match.teamScore ?? score1 ?? "-",
      },
      team2: {
        ...normalizeTeam({
          id: team2?.faceitTeamId,
          name: team2?.name || match.opponentName,
          slug: team2?.slug,
          logo: team2?.logo,
        }),
        score: match.opponentScore ?? score2 ?? "-",
      },
    });
  }

  return [...unique.values()]
    .sort((first, second) => new Date(second.date) - new Date(first.date))
    .slice(0, limit);
}

function Logo({ team, size = "md" }) {
  const [imageError, setImageError] = useState(false);

  const sizes = {
    xs: "h-7 w-7",
    sm: "h-10 w-10",
    md: "h-14 w-14",
    lg: "h-24 w-24 md:h-32 md:w-32",
    // Live Center scoreboard rows — 40px on tablet/desktop, shrinks on mobile
    // so cards stay compact without breaking the row's fixed height.
    card: "h-8 w-8 sm:h-10 sm:w-10",
  };

  const initials =
    team?.name
      ?.trim()
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  if (!team?.logo || imageError) {
    return (
      <div
        className={`${sizes[size] || sizes.md} flex shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#121820] text-xs font-black text-slate-500`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={team.logo}
      alt={team.name}
      className={`${sizes[size] || sizes.md} shrink-0 object-contain`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setImageError(true)}
    />
  );
}

function TeamLink({ team, className = "" }) {
  if (!team?.slug) {
    return (
      <span className={`truncate ${className}`}>
        {team?.name || "TBD"}
      </span>
    );
  }

  return (
    <Link
      to={`/teams/${team.slug}`}
      onClick={(event) => event.stopPropagation()}
      className={`truncate transition hover:text-orange-400 ${className}`}
    >
      {team.name}
    </Link>
  );
}

function TournamentTierBadge({ tier }) {
  const tierStyles = {
    S: "bg-orange-500/10 text-orange-400",
    A: "bg-sky-500/10 text-sky-400",
    B: "bg-emerald-500/10 text-emerald-400",
  };

  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
        tierStyles[tier] || "bg-slate-500/10 text-slate-400"
      }`}
    >
      {tier || "?"}
    </div>
  );
}

function TournamentRow({ tournament, isLive }) {
  const dateRange = !tournament.startDate
    ? "Date TBD"
    : !tournament.endDate || tournament.endDate === tournament.startDate
      ? formatDate(tournament.startDate)
      : `${formatDate(tournament.startDate)} – ${formatDate(tournament.endDate)}`;

  const content = (
    <>
      {tournament.logo ? (
        <img
          src={tournament.logo}
          alt=""
          className="h-10 w-10 shrink-0 rounded-xl bg-[#0b0f14] object-contain p-1.5"
        />
      ) : (
        <TournamentTierBadge tier={tournament.tier} />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black">{tournament.name}</div>
        <div className="mt-1 truncate text-xs text-slate-600">
          {tournament.location || "Location TBD"} · {dateRange}
        </div>
      </div>

      {isLive && (
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-black uppercase tracking-wide text-red-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Live
        </div>
      )}
    </>
  );

  return (
    <Link
      to={`/calendar/${tournament.id}`}
      className="flex items-center gap-3 px-5 py-4 transition hover:bg-white/[0.03]"
    >
      {content}
    </Link>
  );
}

function SectionTitle({ title, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-xl font-black tracking-tight text-white md:text-2xl">
        {title}
      </h2>
      {action}
    </div>
  );
}

function HeroMatch({ match }) {
  if (!match) {
    return (
      <section className="flex min-h-[430px] items-center justify-center rounded-[30px] border border-white/[0.08] bg-[#0c1117] p-8 text-center">
        <div>
          <div className="text-xl font-black text-white">
            No matches available
          </div>
          <Link
            to="/matches"
            className="mt-4 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-400"
          >
            Open matches page
          </Link>
        </div>
      </section>
    );
  }

  const live = isLiveStatus(match.status);
  const matchPath = `/match/${match.matchId || match.id}`;

  return (
    <section className="group relative overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#0c1117] p-6 shadow-2xl shadow-black/25 md:p-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(circle_at_20%_50%,rgba(249,115,22,0.18),transparent_60%)]" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_50%,rgba(56,189,248,0.12),transparent_60%)]" />
      </div>

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={matchPath}
            state={{ from: "/", label: "← Back to Home" }}
            className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-400 transition hover:text-orange-300"
          >
            Match of the Day
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to={matchPath}
              state={{ from: "/", label: "← Back to Home" }}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] transition ${
                live
                  ? "border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/15"
                  : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
              }`}
            >
              {live ? "● Live" : formatCountdown(match.scheduledAt)}
            </Link>

            <Link
              to={matchPath}
              state={{ from: "/", label: "← Back to Home" }}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-black text-slate-400 transition hover:bg-white/[0.08]"
            >
              BO{match.bestOf || "?"}
            </Link>
          </div>
        </div>

        <div className="mt-8 grid items-center gap-8 md:grid-cols-[1fr_180px_1fr]">
          <Link
            to={match.team1?.slug ? `/teams/${match.team1.slug}` : matchPath}
            className="flex min-w-0 flex-col items-center text-center transition hover:-translate-y-1 md:items-start md:text-left"
          >
            <Logo team={match.team1} size="lg" />
            <div className="mt-5 max-w-full truncate text-3xl font-black tracking-tight transition hover:text-orange-400 md:text-5xl">
              {match.team1?.name || "TBD"}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.14em] md:justify-start">
              {match.team1?.rank ? (
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-orange-400">
                  #{match.team1.rank}
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-500">
                  Unranked
                </span>
              )}

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-400">
                {toNumber(match.team1?.points)} PTS
              </span>
            </div>
          </Link>

          <Link
            to={matchPath}
            state={{ from: "/", label: "← Back to Home" }}
            className="rounded-2xl px-3 py-5 text-center transition hover:bg-white/[0.03]"
          >
            {live ? (
              <>
                <div className="text-6xl font-black tracking-[-0.08em]">
                  {match.team1Score}:{match.team2Score}
                </div>
                <div className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-red-400">
                  Live now
                </div>
              </>
            ) : (
              <>
                <div className="text-6xl font-black tracking-[-0.08em]">
                  {formatTime(match.scheduledAt)}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-500">
                  {formatDate(match.scheduledAt)}
                </div>
              </>
            )}

            <div className="mt-4 text-xs font-semibold text-slate-500">
              <TournamentNameLink name={match.season || "ESEA League"} />
            </div>
          </Link>

          <Link
            to={match.team2?.slug ? `/teams/${match.team2.slug}` : matchPath}
            className="flex min-w-0 flex-col items-center text-center transition hover:-translate-y-1 md:items-end md:text-right"
          >
            <Logo team={match.team2} size="lg" />
            <div className="mt-5 max-w-full truncate text-3xl font-black tracking-tight transition hover:text-orange-400 md:text-5xl">
              {match.team2?.name || "TBD"}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.14em] md:justify-end">
              {match.team2?.rank ? (
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-orange-400">
                  #{match.team2.rank}
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-500">
                  Unranked
                </span>
              )}

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-400">
                {toNumber(match.team2?.points)} PTS
              </span>
            </div>
          </Link>
        </div>

        <Link
          to={matchPath}
          state={{ from: "/", label: "← Back to Home" }}
          className="mt-9 flex items-center justify-center border-t border-white/[0.07] pt-6 text-sm font-black text-orange-400 transition hover:text-orange-300"
        >
          Open Match Center →
        </Link>
      </div>
    </section>
  );
}

function LiveCard({ match }) {
  const statusLabel = String(match.status || "LIVE")
    .replace(/^MATCH_STATUS_/, "")
    .toUpperCase();

  const elapsed = match.startedAt ? formatRelative(match.startedAt) : "";
  const map = match.map || match.currentMap || "";

  // For BO1, team*Score already is the current map's round score. For a
  // live BO3+, it's the map-win series score instead — mapProgress (parsed
  // from raw_data.detailed_results) is the only source for the round score
  // of whichever map is actually being played right now, so prefer it
  // whenever it's there and fall back for older/never-live-ticked rows.
  const score1 = match.mapProgress
    ? match.mapProgress.currentScore1
    : Number(match.team1Score) || 0;
  const score2 = match.mapProgress
    ? match.mapProgress.currentScore2
    : Number(match.team2Score) || 0;

  // Maps-won tally only means anything for a multi-map series — a BO1's
  // "map score" and "match score" are the same thing, so showing "(1-0)"
  // next to it would just be noise.
  const showMapsWon = Number(match.bestOf) > 1 && match.mapProgress;

  // Winner's half of the score reads green, loser's red — level (or not
  // started yet) stays neutral white, matching an HLTV-style live row.
  const score1Color =
    score1 > score2
      ? "text-[#4ADE80]"
      : score2 > score1
        ? "text-[#EF4444]"
        : "text-white";
  const score2Color =
    score2 > score1
      ? "text-[#4ADE80]"
      : score1 > score2
        ? "text-[#EF4444]"
        : "text-white";

  const metaParts = [
    { text: `BO${match.bestOf || "?"}` },
    map ? { text: map } : null,
    { text: statusLabel, isStatus: true },
    elapsed ? { text: elapsed } : null,
  ].filter(Boolean);

  return (
    <Link
      to={`/match/${match.matchId || match.id}`}
      state={{ from: "/", label: "← Back to Home" }}
      className="group flex shrink-0 flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 transition hover:border-orange-500/25 hover:bg-white/[0.05] sm:px-3.5 sm:py-3"
    >
      {/* Team 1 row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-[#0b1116] sm:h-9 sm:w-9">
            <Logo team={match.team1} size="card" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold text-white sm:text-sm">
            {match.team1?.name || "TBD"}
          </div>
        </div>
        <div className="flex shrink-0 items-baseline gap-1">
          <span className={`text-base font-extrabold tabular-nums sm:text-lg ${score1Color}`}>
            {score1}
          </span>
          {showMapsWon && (
            <span className="text-[10px] font-semibold tabular-nums text-slate-500 sm:text-xs">
              ({match.mapProgress.mapsWon1})
            </span>
          )}
        </div>
      </div>

      {/* Team 2 row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-[#0b1116] sm:h-9 sm:w-9">
            <Logo team={match.team2} size="card" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold text-white sm:text-sm">
            {match.team2?.name || "TBD"}
          </div>
        </div>
        <div className="flex shrink-0 items-baseline gap-1">
          <span className={`text-base font-extrabold tabular-nums sm:text-lg ${score2Color}`}>
            {score2}
          </span>
          {showMapsWon && (
            <span className="text-[10px] font-semibold tabular-nums text-slate-500 sm:text-xs">
              ({match.mapProgress.mapsWon2})
            </span>
          )}
        </div>
      </div>

      {/* Meta: BOx • Map • LIVE • elapsed */}
      <div className="ml-9 flex items-center gap-1.5 overflow-hidden text-[10px] font-medium text-slate-500 sm:ml-11 sm:text-[11px]">
        {metaParts.map((part, index) => (
          <span
            key={index}
            className="flex shrink-0 items-center gap-1.5 last:min-w-0 last:truncate"
          >
            {index > 0 && <span className="text-slate-700">•</span>}
            {part.isStatus ? (
              <span className="flex items-center gap-1 font-semibold text-red-400">
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                {part.text}
              </span>
            ) : (
              <span className="truncate">{part.text}</span>
            )}
          </span>
        ))}
      </div>
    </Link>
  );
}

function MatchCard({ match }) {
  return (
    <Link
      to={`/match/${match.matchId || match.id}`}
      state={{ from: "/", label: "← Back to Home" }}
      className="group rounded-2xl border border-white/[0.07] bg-[#0d131a] p-4 transition hover:-translate-y-0.5 hover:border-orange-500/25 hover:bg-[#10171f]"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="font-black text-white">
          {formatTime(match.scheduledAt)}
        </div>
        <div className="text-slate-600">{formatDate(match.scheduledAt)}</div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 flex-col items-center text-center">
          <Logo team={match.team1} size="sm" />
          <div className="mt-2 max-w-full truncate text-sm font-bold">
            {match.team1.name}
          </div>
        </div>

        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">
            vs
          </div>
          <div className="mt-1 text-xs font-black text-orange-400">
            BO{match.bestOf || "?"}
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-center text-center">
          <Logo team={match.team2} size="sm" />
          <div className="mt-2 max-w-full truncate text-sm font-bold">
            {match.team2.name}
          </div>
        </div>
      </div>

      <div className="mt-4 truncate border-t border-white/[0.06] pt-3 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
        <TournamentNameLink name={match.season || "ESEA League"} />
      </div>
    </Link>
  );
}

function ResultCard({ match }) {
  const firstScore = Number(match.team1.score);
  const secondScore = Number(match.team2.score);
  const firstWon = Number.isFinite(firstScore) && firstScore > secondScore;
  const secondWon = Number.isFinite(secondScore) && secondScore > firstScore;

  return (
    <Link
      to={`/match/${match.matchId || match.id}`}
      state={{ from: "/", label: "← Back to Home" }}
      className="group rounded-2xl border border-white/[0.07] bg-[#0d131a] p-4 transition hover:-translate-y-0.5 hover:border-emerald-500/20 hover:bg-[#10171f]"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="truncate text-slate-600">
          <TournamentNameLink name={match.season || "ESEA League"} />
        </div>
        <div className="shrink-0 text-slate-600">
          {formatRelative(match.date)}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <Logo team={match.team1} size="xs" />
          <div
            className={`min-w-0 flex-1 truncate text-sm font-bold ${
              firstWon ? "text-white" : "text-slate-500"
            }`}
          >
            {match.team1.name}
          </div>
          <div
            className={`text-xl font-black ${
              firstWon ? "text-emerald-400" : "text-slate-600"
            }`}
          >
            {match.team1.score}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Logo team={match.team2} size="xs" />
          <div
            className={`min-w-0 flex-1 truncate text-sm font-bold ${
              secondWon ? "text-white" : "text-slate-500"
            }`}
          >
            {match.team2.name}
          </div>
          <div
            className={`text-xl font-black ${
              secondWon ? "text-emerald-400" : "text-slate-600"
            }`}
          >
            {match.team2.score}
          </div>
        </div>
      </div>
    </Link>
  );
}


function findPlayerTeam(teamId, teamName, nickname) {
  const normalizedTeamId = String(teamId || "").trim();
  const normalizedTeamName = normalizeName(teamName);
  const normalizedNickname = normalizeName(nickname);

  const localTeam =
    teams.find((team) => {
      const candidateIds = [
        team?.id,
        team?.teamId,
        team?.team_id,
        team?.faceitTeamId,
        team?.faceit_team_id,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim());

      if (
        normalizedTeamId &&
        candidateIds.includes(normalizedTeamId)
      ) {
        return true;
      }

      return (
        normalizedTeamName &&
        normalizeName(team?.name) === normalizedTeamName
      );
    }) ||
    teams.find((team) =>
      (Array.isArray(team?.players) ? team.players : []).some((player) => {
        const playerName =
          typeof player === "string"
            ? player
            : player?.nickname ||
              player?.name ||
              player?.player_name;

        return (
          normalizedNickname &&
          normalizeName(playerName) === normalizedNickname
        );
      })
    ) ||
    null;

  if (localTeam) {
    return normalizeTeam(localTeam);
  }

  if (teamName) {
    return normalizeTeam({
      id: teamId || null,
      teamId: teamId || null,
      name: teamName,
      slug: slugify(teamName),
      logo: null,
    });
  }

  return null;
}

function TopPlayerRow({ player, index }) {
  const playerPath = player?.playerId
    ? `/players/${encodeURIComponent(player.playerId)}`
    : `/players/${encodeURIComponent(player.nickname)}`;

  const rankStyles = [
    "border-amber-400/25 bg-amber-400/10 text-amber-300",
    "border-slate-300/20 bg-slate-300/10 text-slate-300",
    "border-orange-500/25 bg-orange-500/10 text-orange-400",
  ];

  return (
    <Link
      to={playerPath}
      className="group flex items-center gap-3 px-5 py-4 transition hover:bg-white/[0.035]"
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-black ${
          rankStyles[index] ||
          "border-white/10 bg-white/[0.04] text-slate-500"
        }`}
      >
        {index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black text-white transition group-hover:text-orange-400">
          {player.nickname}
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-2">
          {player.team ? (
            <>
              <Logo team={player.team} size="xs" />
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {player.team.name}
              </span>
            </>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Team unavailable
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-lg font-black text-emerald-400">
          {toNumber(player.rating).toFixed(2)}
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
          Rating
        </div>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-xs font-black text-white">
          {toNumber(player.adr).toFixed(1)}
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
          ADR
        </div>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-xs font-black text-white">
          {toNumber(player.kd).toFixed(2)}
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
          K/D
        </div>
      </div>
    </Link>
  );
}

function RankingCard({ team, index }) {
  return (
    <Link
      to={`/teams/${team.slug}`}
      className="group flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#0d131a] p-4 transition hover:-translate-y-0.5 hover:border-orange-500/25 hover:bg-[#10171f]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-xs font-black text-orange-400">
        {team.rank || index + 1}
      </div>

      <Logo team={team} size="xs" />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black">{team.name}</div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
          {team.division || "ESEA"}
        </div>
      </div>

      <div className="text-right">
        <div className="text-lg font-black">{team.points}</div>

        <div className="mt-1 flex items-center justify-end gap-2 text-[9px] font-black uppercase tracking-wider">
          <span className="text-slate-600">pts</span>

          {team.pointsChange !== 0 && (
            <span
              className={
                team.pointsChange > 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }
            >
              {team.pointsChange > 0 ? "+" : ""}
              {team.pointsChange}
            </span>
          )}

          {team.rankChange !== 0 && (
            <span
              className={
                team.rankChange > 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }
            >
              {team.rankChange > 0 ? "↑" : "↓"}
              {Math.abs(team.rankChange)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function NewsCard({
  title,
  text,
  tag,
  to,
  large = false,
}) {
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d131a] p-5 transition hover:-translate-y-0.5 hover:border-orange-500/25 hover:bg-[#10171f] ${
        large ? "min-h-[300px] md:p-7" : ""
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(249,115,22,0.12),transparent_45%)]" />

      <div className="relative flex h-full flex-col justify-end">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">
          {tag}
        </div>

        <h3
          className={`mt-3 font-black tracking-tight transition group-hover:text-orange-400 ${
            large ? "text-3xl" : "text-lg"
          }`}
        >
          {title}
        </h3>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          {text}
        </p>

        <div className="mt-5 text-xs font-black text-orange-400 opacity-80 transition group-hover:translate-x-1 group-hover:opacity-100">
          Read more →
        </div>
      </div>
    </Link>
  );
}

function Home() {
  const [databaseRows, setDatabaseRows] = useState([]);
  const [databaseReady, setDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState("");
  const [ratingRows, setRatingRows] = useState([]);
  const [ratingsReady, setRatingsReady] = useState(false);
  const [topPlayers, setTopPlayers] = useState([]);
  const [playersReady, setPlayersReady] = useState(false);
  const [playersError, setPlayersError] = useState("");

  const upcomingSectionRef = useRef(null);
  const recentResultsSectionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let channel = null;

    async function loadMatches() {
      if (!supabase) {
        if (!cancelled) {
          setDatabaseError("Supabase client is not configured");
          setDatabaseReady(true);
        }
        return;
      }

      const now = new Date();
      const end = new Date(
        Date.now() + UPCOMING_WINDOW_HOURS * 60 * 60 * 1000
      );

      const liveStatusFilter = [
        "status.eq.LIVE",
        "status.eq.READY",
        "status.eq.STARTED",
        "status.eq.ONGOING",
        "status.eq.IN_PROGRESS",
        "status.eq.RUNNING",
        "status.eq.VOTING",
        "status.eq.CONFIGURING",
        "status.eq.MATCH_STATUS_READY",
        "status.eq.MATCH_STATUS_LIVE",
        "status.eq.MATCH_STATUS_STARTED",
        "status.eq.MATCH_STATUS_ONGOING",
        "status.eq.MATCH_STATUS_VOTING",
        "status.eq.MATCH_STATUS_CONFIGURING",
      ].join(",");

      const upcomingStatusFilter = [
        "SCHEDULED",
        "MATCH_STATUS_SCHEDULED",
      ].join(",");

      const upcomingTimeFilter = [
        `status.in.(${upcomingStatusFilter})`,
        `scheduled_at.gte.${now.toISOString()}`,
        `scheduled_at.lte.${end.toISOString()}`,
      ].join(",");

      const [activeResponse, finishedResponse] = await Promise.all([
        supabase
          .from("matches")
          .select("*")
          .or(`${liveStatusFilter},and(${upcomingTimeFilter})`)
          .order("scheduled_at", {
            ascending: true,
            nullsFirst: false,
          })
          .limit(200),

        supabase
          .from("matches")
          .select("*")
          .in("status", [
            "FINISHED",
            "MATCH_STATUS_FINISHED",
          ])
          .order("finished_at", {
            ascending: false,
            nullsFirst: false,
          })
          .limit(RESULTS_LIMIT),
      ]);

      if (cancelled) return;

      const error = activeResponse.error || finishedResponse.error;

      if (error) {
        setDatabaseError(error.message);
      } else {
        setDatabaseRows([
          ...(activeResponse.data || []),
          ...(finishedResponse.data || []),
        ]);
        setDatabaseError("");
      }

      setDatabaseReady(true);
    }

    loadMatches();

    const intervalId = window.setInterval(loadMatches, 30000);

    if (supabase) {
      channel = supabase
        .channel("home-card-layout")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "matches",
          },
          loadMatches
        )
        .subscribe();
    }

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);

      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ratingsChannel = null;

    async function loadRatings() {
      if (!supabase) {
        if (!cancelled) setRatingsReady(true);
        return;
      }

      // PostgREST caps an unbounded select() at 1000 rows — with 1092+
      // teams in team_ratings, that silently dropped whichever ~90 rows
      // sorted last, no error surfaced. Page via .range() instead.
      const PAGE_SIZE = 1000;
      const allRows = [];
      let error = null;

      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error: pageError } = await supabase
          .from("team_ratings")
          .select("*")
          .range(from, from + PAGE_SIZE - 1);

        if (pageError) {
          error = pageError;
          break;
        }

        const page = Array.isArray(data) ? data : [];
        allRows.push(...page);

        if (page.length < PAGE_SIZE) break;
      }

      if (cancelled) return;

      if (error) {
        console.error("Failed to load ratings on Home:", error);
        setRatingRows([]);
      } else {
        setRatingRows(allRows);
      }

      setRatingsReady(true);
    }

    loadRatings();

    if (supabase) {
      ratingsChannel = supabase
        .channel("home-team-ratings")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "team_ratings",
          },
          loadRatings
        )
        .subscribe();
    }

    return () => {
      cancelled = true;

      if (supabase && ratingsChannel) {
        supabase.removeChannel(ratingsChannel);
      }
    };
  }, []);

  const activeMatches = useMemo(() => {
    if (!databaseReady || databaseRows.length === 0) {
      return getStaticUpcoming();
    }

    return databaseRows
      .filter((row) => {
        if (isFinishedStatus(row.status)) {
          return false;
        }

        if (isLiveStatus(row.status)) {
          return true;
        }

        return isWithinUpcomingWindow(row.scheduled_at);
      })
      .map(dbRowToMatch)
      .sort(
        (first, second) =>
          new Date(first.scheduledAt) - new Date(second.scheduledAt)
      );
  }, [databaseReady, databaseRows]);

  const results = useMemo(() => {
    if (!databaseReady || databaseRows.length === 0) {
      return getStaticResults();
    }

    return databaseRows
      .filter((row) => isFinishedStatus(row.status))
      .map(dbRowToResult)
      .sort((first, second) => new Date(second.date) - new Date(first.date))
      .slice(0, RESULTS_LIMIT);
  }, [databaseReady, databaseRows]);


  useEffect(() => {
    let cancelled = false;
    let playerRatingsChannel = null;

    async function loadTopPlayers() {
      if (!supabase) {
        if (!cancelled) {
          setTopPlayers([]);
          setPlayersError("Supabase client is not configured");
          setPlayersReady(true);
        }
        return;
      }

      const { data: ratingData, error: ratingError } = await supabase
        .from("player_ratings")
        .select(
          [
            "player_id",
            "nickname",
            "rating",
            "recent_rating",
            "matches_played",
            "maps_played",
            "adr",
            "kd",
            "last_match_at",
            "team_id",
            "team_name",
          ].join(",")
        )
        .not("rating", "is", null)
        .gt("matches_played", 5)
        .order("rating", { ascending: false })
        .limit(5);

      if (cancelled) return;

      if (ratingError) {
        console.error("Failed to load top players:", ratingError);
        setTopPlayers([]);
        setPlayersError(ratingError.message);
        setPlayersReady(true);
        return;
      }

      const normalizedPlayers = (
        Array.isArray(ratingData) ? ratingData : []
      ).map((row) => {
        const nickname =
          row.nickname || "Unknown player";

        return {
          playerId: row.player_id,
          nickname,
          rating: toNumber(row.rating),
          recentRating: toNumber(row.recent_rating),
          matchesPlayed: toNumber(row.matches_played),
          mapsPlayed: toNumber(row.maps_played),
          adr: toNumber(row.adr),
          kd: toNumber(row.kd),
          lastMatchAt: row.last_match_at || null,
          team: findPlayerTeam(
            row.team_id,
            row.team_name,
            nickname
          ),
        };
      });

      if (!cancelled) {
        setTopPlayers(normalizedPlayers);
        setPlayersError("");
        setPlayersReady(true);
      }
    }

    loadTopPlayers();

    if (supabase) {
      playerRatingsChannel = supabase
        .channel("home-player-ratings")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "player_ratings",
          },
          loadTopPlayers
        )
        .subscribe();
    }

    return () => {
      cancelled = true;

      if (supabase && playerRatingsChannel) {
        supabase.removeChannel(playerRatingsChannel);
      }
    };
  }, []);

  const rankedTeams = useMemo(() => {
    const syncedTeams = mergeRatingTeams(ratingRows);

    if (syncedTeams.length > 0) {
      return syncedTeams;
    }

    /*
     * Fallback only when Supabase is unavailable.
     * As soon as team_ratings loads, Home automatically
     * displays the same ranking as RankingsPage.
     */
    return [...teams]
      .filter(
        (team) =>
          Number.isFinite(Number(team.points)) &&
          team.slug &&
          team.name
      )
      .sort(
        (first, second) =>
          toNumber(second.points) - toNumber(first.points)
      )
      .map((team, index) => ({
        ...normalizeTeam(team),
        rank: index + 1,
        pointsChange: 0,
        rankChange: 0,
      }));
  }, [ratingRows]);

  const topTeams = useMemo(
    () => rankedTeams.slice(0, 8),
    [rankedTeams]
  );

  const liveMatches = activeMatches.filter((match) =>
    isLiveStatus(match.status)
  );

  const upcoming = activeMatches.filter(
    (match) => !isLiveStatus(match.status)
  );

  const liveTournament = useMemo(
    () =>
      tournaments.find(
        (tournament) => getTournamentStatus(tournament) === "live"
      ) || null,
    []
  );

  const upcomingTournaments = useMemo(
    () =>
      tournaments
        .filter(
          (tournament) => getTournamentStatus(tournament) === "upcoming"
        )
        .sort(
          (first, second) =>
            new Date(first.startDate) - new Date(second.startDate)
        )
        .slice(0, 4),
    []
  );

  const featuredBase =
    selectFeaturedMatch(liveMatches) ||
    selectFeaturedMatch(upcoming);

  const featured = useMemo(() => {
    if (!featuredBase) return null;

    return {
      ...featuredBase,
      team1: applyRatingToTeam(
        featuredBase.team1,
        rankedTeams
      ),
      team2: applyRatingToTeam(
        featuredBase.team2,
        rankedTeams
      ),
    };
  }, [featuredBase, rankedTeams]);

  const popularRecentMatch = useMemo(
    () => selectPopularCompletedMatch(results),
    [results]
  );

  const popularRecentMatchPath = popularRecentMatch
    ? `/match/${popularRecentMatch.matchId || popularRecentMatch.id}`
    : null;

  return (
    <main className="min-h-screen bg-[#090d12] text-white">
      <style>{`
        .home-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.28) transparent;
        }

        .home-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .home-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .home-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.24);
          border-radius: 999px;
        }

        .home-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(249, 115, 22, 0.48);
        }
      `}</style>
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        {databaseError && (
          <div className="mb-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.05] px-4 py-3 text-sm text-yellow-300">
            Supabase is temporarily unavailable. Local data is being shown.
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_420px]">
          <HeroMatch match={featured} />

          <div className="grid gap-6">
            <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#111820]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">
                    Live matches
                  </div>
                  <h2 className="mt-1 text-xl font-black">
                    Live Center
                  </h2>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-red-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  {liveMatches.length} live
                </div>
              </div>

              {liveMatches.length > 0 ? (
                <div className="max-h-[360px] space-y-2 overflow-y-auto overflow-x-hidden p-2.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
                  {liveMatches.map((match) => (
                    <LiveCard
                      key={match.id}
                      match={match}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center px-6 text-center text-sm text-slate-600">
                  No live matches right now
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#111820]">
              <Link
                to="/calendar"
                className="group block border-b border-white/[0.06] px-5 py-4 transition hover:bg-white/[0.03]"
              >
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">
                  Event Calendar
                </div>
                <h2 className="mt-1 text-xl font-black transition group-hover:text-orange-400">
                  Upcoming Tournaments
                </h2>
              </Link>

              {liveTournament || upcomingTournaments.length > 0 ? (
                <div className="divide-y divide-white/[0.06]">
                  {liveTournament && (
                    <TournamentRow tournament={liveTournament} isLive />
                  )}

                  {upcomingTournaments.map((tournament) => (
                    <TournamentRow
                      key={tournament.id}
                      tournament={tournament}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center px-6 text-center text-sm text-slate-600">
                  No tournaments scheduled yet
                </div>
              )}
            </section>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section
            ref={upcomingSectionRef}
            className="scroll-mt-24 rounded-[24px] border border-white/[0.07] bg-[#111820] p-5"
          >
            <SectionTitle title="Upcoming Matches" />

            {upcoming.length > 0 ? (
              <div className="home-scrollbar max-h-[620px] overflow-y-auto pr-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  {upcoming.map((match) => (
                  <MatchCard
                    key={match.matchId || match.id}
                    match={match}
                  />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-white/[0.06] bg-[#0d131a] px-6 text-center text-sm text-slate-600">
                No matches scheduled in the next 24 hours
              </div>
            )}
          </section>

          <section
            ref={recentResultsSectionRef}
            className="scroll-mt-24 rounded-[24px] border border-white/[0.07] bg-[#111820] p-5"
          >
            <SectionTitle title="Recent Results" />

            <div className="home-scrollbar max-h-[620px] overflow-y-auto pr-2">
              <div className="grid gap-4 sm:grid-cols-2">
                {results.map((match) => (
                  <ResultCard
                    key={match.matchId || match.id}
                    match={match}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>

        <section className="mt-8">
          <SectionTitle
            title="Top Teams"
            action={
              <Link
                to="/rankings"
                className="text-sm font-black text-orange-400 hover:text-orange-300"
              >
                Full rankings →
              </Link>
            }
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {topTeams.slice(0, 8).map((team, index) => (
              <RankingCard
                key={team.slug || team.name}
                team={team}
                index={index}
              />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <SectionTitle title="Latest Updates" />

          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
            <NewsCard
              large
              to="/about"
              tag="PLATFORM"
              title="Matches, rankings, and statistics in one place"
              text="ESEA Tracker automatically collects schedules, results, maps, and player statistics."
            />

            <NewsCard
              to="/rankings"
              tag="RANKINGS"
              title="Team rankings update after completed matches"
              text="Points and positions are recalculated automatically after synchronization."
            />

            <NewsCard
              to={popularRecentMatchPath || "/stats"}
              tag="STATISTICS"
              title={
                popularRecentMatch
                  ? `${popularRecentMatch.team1?.name || "Team 1"} vs ${
                      popularRecentMatch.team2?.name || "Team 2"
                    }`
                  : "MVP, ADR, and K/D are available in the Match Center"
              }
              text={
                popularRecentMatch
                  ? "Open the most popular recent completed match. Automatic wins and walkovers are excluded."
                  : "Statistics appear after FACEIT publishes the match data."
              }
            />
          </div>
        </section>
      </div>
    </main>
  );
}

export default Home;