import { useMemo } from "react";
import { Link } from "react-router-dom";

import upcomingMatches from "../data/upcomingMatches";
import matchesData from "../data/matches";
import teams from "../data/teams";

const LIVE_STATUSES = new Set([
  "LIVE",
  "ONGOING",
  "MATCH_STATUS_ONGOING",
]);

function normalizeName(value = "") {
  return value.replace(/\s+/g, "").toLowerCase();
}

function findTeamByName(name) {
  if (!name) return null;

  return (
    teams.find(
      (team) =>
        normalizeName(team.name) === normalizeName(name)
    ) || null
  );
}

function findTeamById(faceitTeamId) {
  if (!faceitTeamId) return null;

  return (
    teams.find(
      (team) => team.faceitTeamId === faceitTeamId
    ) || null
  );
}

function normalizeTeam(team) {
  if (!team) {
    return {
      name: "TBD",
      slug: null,
      logo: null,
      points: 0,
    };
  }

  const localTeam =
    findTeamById(team.id) ||
    findTeamByName(team.name);

  return {
    name:
      localTeam?.name ||
      team.name ||
      "TBD",
    slug:
      localTeam?.slug ||
      team.slug ||
      null,
    logo:
      localTeam?.logo ||
      team.logo ||
      null,
    points:
      localTeam?.points ??
      team.points ??
      0,
  };
}

function formatTime(value) {
  if (!value) return "TBD";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function isToday(value) {
  if (!value) return false;

  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}


function getLeaguePriority(season = "") {
  const value = season.toLowerCase();

  if (
    value.includes("ecl") ||
    value.includes("finals")
  ) {
    return 600;
  }

  if (
    value.includes("advanced") &&
    value.includes("playoff")
  ) {
    return 550;
  }

  if (value.includes("advanced")) {
    return 500;
  }

  if (
    value.includes("main") &&
    value.includes("playoff")
  ) {
    return 450;
  }

  if (value.includes("main")) {
    return 400;
  }

  if (
    value.includes("intermediate") &&
    value.includes("playoff")
  ) {
    return 350;
  }

  if (value.includes("intermediate")) {
    return 300;
  }

  if (
    value.includes("entry") &&
    value.includes("playoff")
  ) {
    return 250;
  }

  if (value.includes("entry")) {
    return 200;
  }

  if (value.includes("playoff")) {
    return 150;
  }

  return 100;
}

function getMatchImportance(match) {
  const league =
    match.season ||
    match.championshipName ||
    "";

  const leagueScore =
    getLeaguePriority(league) * 100000;

  const teamStrength =
    Number(match.team1?.points || 0) +
    Number(match.team2?.points || 0);

  const scheduledTime =
    new Date(match.scheduledAt).getTime();

  const timeTieBreaker =
    Number.isNaN(scheduledTime)
      ? 0
      : Math.max(
          0,
          10000000000000 - scheduledTime
        ) / 10000000000000;

  return (
    leagueScore +
    teamStrength +
    timeTieBreaker
  );
}

function selectFeaturedMatch(matches) {
  return (
    [...matches].sort(
      (first, second) =>
        getMatchImportance(second) -
        getMatchImportance(first)
    )[0] || null
  );
}

function getUpcoming() {
  return [...upcomingMatches]
    .map((match) => ({
      ...match,
      team1: normalizeTeam(match.team1),
      team2: normalizeTeam(match.team2),
    }))
    .sort(
      (a, b) =>
        new Date(a.scheduledAt) -
        new Date(b.scheduledAt)
    );
}

function getResults(limit = 10) {
  const unique = new Map();

  for (const match of matchesData) {
    const matchId = match.matchId || match.id;

    if (!matchId || unique.has(matchId)) {
      continue;
    }

    const team1 =
      teams.find(
        (team) => team.slug === match.teamSlug
      ) || findTeamByName(match.teamName);

    const team2 =
      findTeamByName(match.opponentName);

    const [fallbackScore1, fallbackScore2] =
      String(match.boScore || "")
        .split(":")
        .map((value) => value.trim());

    unique.set(matchId, {
      id: matchId,
      date: match.date,
      season: match.season,
      bestOf: match.bestOf,
      team1: {
        name:
          team1?.name ||
          match.teamName ||
          "Unknown",
        slug:
          team1?.slug ||
          match.teamSlug ||
          null,
        logo: team1?.logo || null,
        score:
          match.teamScore ??
          fallbackScore1 ??
          "-",
      },
      team2: {
        name:
          team2?.name ||
          match.opponentName ||
          "Unknown",
        slug: team2?.slug || null,
        logo: team2?.logo || null,
        score:
          match.opponentScore ??
          fallbackScore2 ??
          "-",
      },
    });
  }

  return [...unique.values()]
    .sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    )
    .slice(0, limit);
}

function getTopTeams(limit = 8) {
  return [...teams]
    .filter(
      (team) =>
        typeof team.points === "number" &&
        team.slug &&
        team.name
    )
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

function Logo({ team, size = "md" }) {
  const sizeClass =
    size === "sm"
      ? "h-7 w-7"
      : size === "lg"
      ? "h-12 w-12"
      : "h-9 w-9";

  if (!team?.logo) {
    return (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-md border border-white/5 bg-[#151a21] text-[10px] font-black text-gray-500`}
      >
        {team?.name
          ?.slice(0, 2)
          .toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <img
      src={team.logo}
      alt={team.name}
      className={`${sizeClass} shrink-0 object-contain`}
    />
  );
}

function TeamLink({
  team,
  className = "",
}) {
  if (team?.slug) {
    return (
      <Link
        to={`/team/${team.slug}`}
        onClick={(event) => event.stopPropagation()}
        className={`truncate transition hover:text-orange-400 ${className}`}
      >
        {team.name}
      </Link>
    );
  }

  return (
    <span className={`truncate ${className}`}>
      {team?.name || "TBD"}
    </span>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 bg-[#10151c] px-4 py-3">
      <div>
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-0.5 text-xs text-gray-600">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

function LiveStrip({ matches }) {
  if (matches.length === 0) {
    return null;
  }

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-red-500/15 bg-[#0f141a]">
      <div className="flex items-center gap-3 border-b border-red-500/10 bg-red-500/[0.05] px-4 py-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />

        <span className="text-xs font-black uppercase tracking-[0.16em] text-red-400">
          Live now
        </span>

        <span className="text-xs text-gray-600">
          {matches.length} match
          {matches.length === 1 ? "" : "es"}
        </span>
      </div>

      <div className="grid gap-px bg-white/5 md:grid-cols-2 xl:grid-cols-3">
        {matches.map((match) => (
          <Link
            key={match.matchId || match.id}
            to={`/matches/${match.matchId || match.id}`}
            className="group bg-[#0d1218] p-4 transition hover:bg-[#121820]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-gray-600">
                {match.season ||
                  match.championshipName ||
                  "ESEA League"}
              </span>

              <span className="text-[11px] font-bold text-red-400">
                LIVE
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Logo team={match.team1} size="sm" />

                <TeamLink
                  team={match.team1}
                  className="font-semibold"
                />
              </div>

              <div className="flex items-center gap-2">
                <Logo team={match.team2} size="sm" />

                <TeamLink
                  team={match.team2}
                  className="font-semibold"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
              <span className="text-gray-600">
                BO{match.bestOf || "?"}
              </span>

              <span className="font-semibold text-red-400 transition group-hover:text-red-300">
                Open room →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MatchListItem({ match }) {
  return (
    <Link
      to={`/matches/${match.matchId || match.id}`}
      className="group grid grid-cols-[58px_1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-3.5 transition last:border-b-0 hover:bg-white/[0.025]"
    >
      <div>
        <div className="text-sm font-black text-white">
          {formatTime(match.scheduledAt)}
        </div>

        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-600">
          {isToday(match.scheduledAt)
            ? "today"
            : formatDate(match.scheduledAt)}
        </div>
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <Logo team={match.team1} size="sm" />

          <TeamLink
            team={match.team1}
            className="text-sm font-semibold"
          />
        </div>

        <div className="flex items-center gap-2">
          <Logo team={match.team2} size="sm" />

          <TeamLink
            team={match.team2}
            className="text-sm font-semibold"
          />
        </div>
      </div>

      <div className="text-right">
        <div className="text-xs font-bold text-gray-500">
          BO{match.bestOf || "?"}
        </div>

        <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-700 transition group-hover:text-orange-400">
          match
        </div>
      </div>
    </Link>
  );
}

function ResultListItem({ match }) {
  const firstScore = Number(match.team1.score);
  const secondScore = Number(match.team2.score);

  const firstWon =
    Number.isFinite(firstScore) &&
    Number.isFinite(secondScore) &&
    firstScore > secondScore;

  const secondWon =
    Number.isFinite(firstScore) &&
    Number.isFinite(secondScore) &&
    secondScore > firstScore;

  return (
    <Link
      to={`/matches/${match.id}`}
      className="group grid grid-cols-[1fr_auto] gap-3 border-b border-white/5 px-4 py-3.5 transition last:border-b-0 hover:bg-white/[0.025]"
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <Logo team={match.team1} size="sm" />

          <TeamLink
            team={match.team1}
            className={`text-sm font-semibold ${
              firstWon
                ? "text-white"
                : "text-gray-500"
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <Logo team={match.team2} size="sm" />

          <TeamLink
            team={match.team2}
            className={`text-sm font-semibold ${
              secondWon
                ? "text-white"
                : "text-gray-500"
            }`}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="grid grid-rows-2 gap-1 text-right text-sm font-black">
          <span
            className={
              firstWon
                ? "text-green-400"
                : "text-gray-600"
            }
          >
            {match.team1.score ?? "-"}
          </span>

          <span
            className={
              secondWon
                ? "text-green-400"
                : "text-gray-600"
            }
          >
            {match.team2.score ?? "-"}
          </span>
        </div>

        <div className="text-[10px] uppercase tracking-wide text-gray-700">
          {formatDate(match.date)}
        </div>
      </div>
    </Link>
  );
}

function RankingItem({ team, index }) {
  return (
    <Link
      to={`/team/${team.slug}`}
      className="group flex items-center gap-3 border-b border-white/5 px-4 py-3 transition last:border-b-0 hover:bg-white/[0.025]"
    >
      <span className="w-5 text-xs font-black text-orange-400">
        {index + 1}
      </span>

      <Logo team={team} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold transition group-hover:text-orange-400">
          {team.name}
        </div>

        <div className="text-[10px] uppercase tracking-wide text-gray-700">
          {team.division || "ESEA"}
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm font-black">
          {team.points}
        </div>

        <div className="text-[9px] uppercase tracking-wide text-gray-700">
          pts
        </div>
      </div>
    </Link>
  );
}

function FeaturedPanel({ match }) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/5 bg-[#0d1218]">
      <SectionHeader
        title="Featured"
        subtitle="Главный матч дня"
      />

      <div className="bg-[#0d1218] p-6 md:p-8">
        {match ? (
          <Link
            to={`/matches/${match.matchId || match.id}`}
            state={{
              from: "/",
              label: "← Back to Home",
            }}
            className="group block"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-orange-400">
                  Main match
                </div>

                <div className="mt-1 text-xs text-gray-600">
                  {match.season ||
                    match.championshipName ||
                    "ESEA League"}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-black text-white">
                  {formatTime(match.scheduledAt)}
                </div>

                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                  {formatDate(match.scheduledAt)}
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-5 md:gap-10">
              <div className="flex min-w-0 flex-col items-center">
                <Logo team={match.team1} size="lg" />

                <TeamLink
                  team={match.team1}
                  className="mt-3 max-w-full text-center text-base font-black md:text-xl"
                />
              </div>

              <div className="text-center">
                <div className="text-4xl font-black text-white md:text-6xl">
                  {formatTime(match.scheduledAt)}
                </div>

                <div className="mt-2 inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-400">
                  BO{match.bestOf || "?"}
                </div>
              </div>

              <div className="flex min-w-0 flex-col items-center">
                <Logo team={match.team2} size="lg" />

                <TeamLink
                  team={match.team2}
                  className="mt-3 max-w-full text-center text-base font-black md:text-xl"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center border-t border-white/5 pt-5 text-sm font-bold text-orange-400 transition group-hover:text-orange-300">
              Open match room →
            </div>
          </Link>
        ) : (
          <div className="py-12 text-center text-sm text-gray-600">
            No upcoming match
          </div>
        )}
      </div>
    </section>
  );
}
function Home() {
  const upcoming = useMemo(
    () => getUpcoming(),
    []
  );

  const results = useMemo(
    () => getResults(),
    []
  );

  const topTeams = useMemo(
    () => getTopTeams(),
    []
  );

  const liveMatches = upcoming.filter((match) =>
    LIVE_STATUSES.has(
      match.status?.toUpperCase() || ""
    )
  );

  const nonLiveMatches = upcoming.filter(
    (match) =>
      !LIVE_STATUSES.has(
        match.status?.toUpperCase() || ""
      )
  );

  const featuredMatch =
    liveMatches.length > 0
      ? selectFeaturedMatch(liveMatches)
      : selectFeaturedMatch(nonLiveMatches);

  return (
    <main className="min-h-screen bg-[#080b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-8 md:py-6">
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-white/5 bg-[#0d1218] px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-black">
              ESEA Tracker
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              Матчи, результаты и рейтинг команд
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/rankings"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold transition hover:bg-orange-600"
            >
              Rankings
            </Link>

            <Link
              to="/players"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-bold text-gray-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              Players
            </Link>
          </div>
        </div>

        <LiveStrip matches={liveMatches} />

        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <aside className="order-2 space-y-4 xl:order-1">
            <section className="flex h-[720px] flex-col overflow-hidden rounded-xl border border-white/5 bg-[#0d1218]">
              <SectionHeader
                title="Upcoming"
                subtitle="Ближайшие матчи"
                action={
                  <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-[11px] font-bold text-orange-400">
                    {nonLiveMatches.length}
                  </span>
                }
              />

              {nonLiveMatches.length > 0 ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:#374151_#0d1218] [scrollbar-width:thin]">
                  {nonLiveMatches.map((match) => (
                      <MatchListItem
                        key={match.matchId || match.id}
                        match={match}
                      />
                    ))}
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-gray-600">
                  No upcoming matches
                </div>
              )}
            </section>
          </aside>

          <div className="order-1 space-y-4 xl:order-2">
            <FeaturedPanel
              match={featuredMatch}
            />

            <section className="overflow-hidden rounded-xl border border-white/5 bg-[#0d1218]">
              <SectionHeader
                title="News feed"
                subtitle="Здесь позже будет лента новостей"
                action={
                  <span className="text-xs font-bold text-gray-600">
                    Coming soon
                  </span>
                }
              />

              <div className="grid gap-px bg-white/5 md:grid-cols-2">
                <article className="bg-[#0d1218] p-5">
                  <div className="mb-4 h-36 rounded-lg bg-[linear-gradient(135deg,#151b24,#0f141a)]" />

                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-400">
                    ESEA
                  </div>

                  <h3 className="mt-2 text-lg font-black">
                    Новости лиги появятся здесь
                  </h3>

                  
                </article>

                <div className="bg-[#0d1218]">
                  {[
                    "Последние изменения в составах",
                    "Главные матчи игрового дня",
                    "Кто поднялся в рейтинге",
                    "Лучшие игроки недели",
                  ].map((title, index) => (
                    <div
                      key={title}
                      className="flex gap-3 border-b border-white/5 p-4 last:border-b-0"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-500/10 text-xs font-black text-orange-400">
                        {index + 1}
                      </div>

                      <div>
                        <div className="text-sm font-bold">
                          {title}
                        </div>

                        <div className="mt-1 text-xs text-gray-700">
                          News placeholder
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="order-3 space-y-4">
            <section className="flex h-[720px] flex-col overflow-hidden rounded-xl border border-white/5 bg-[#0d1218]">
              <SectionHeader
                title="Recent results"
                subtitle="Последние завершённые игры"
                action={
                  <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-[11px] font-bold text-green-400">
                    {results.length}
                  </span>
                }
              />

              {results.length > 0 ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:#374151_#0d1218] [scrollbar-width:thin]">
                  {results.map((match) => (
                      <ResultListItem
                        key={match.id}
                        match={match}
                      />
                    ))}
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-gray-600">
                  No recent results
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-white/5 bg-[#0d1218]">
              <SectionHeader
                title="Team ranking"
                subtitle="Лучшие команды"
                action={
                  <Link
                    to="/rankings"
                    className="text-xs font-bold text-orange-400 hover:text-orange-300"
                  >
                    All →
                  </Link>
                }
              />

              <div>
                {topTeams.map((team, index) => (
                  <RankingItem
                    key={team.slug}
                    team={team}
                    index={index}
                  />
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default Home;