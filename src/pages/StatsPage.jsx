import {
  Link,
  useParams,
} from "react-router-dom";

import teams from "../data/teams";
import matchesData from "../data/matches";
import { useTeamStats } from "../hooks/useTeamStats";
import TournamentNameLink from "../components/TournamentNameLink";

const MAP_IMAGE_ALIASES = {
  ancient: "ancient",
  anubis: "anubis",
  cache: "cache",
  cobblestone: "cobblestone",
  dust2: "dust2",
  inferno: "inferno",
  mirage: "mirage",
  nuke: "nuke",
  train: "train",
  vertigo: "vertigo",
};

function normalizeMapImageName(name) {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/^de_/, "")
    .replace(/[\s_-]+/g, "");

  return MAP_IMAGE_ALIASES[normalized] || normalized;
}

function formatMapName(name) {
  return String(name || "Unknown")
    .replace(/^de_/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getWinrateTextClass(winrate) {
  if (winrate >= 60) return "text-emerald-400";
  if (winrate < 40) return "text-rose-400";
  return "text-orange-400";
}

function getStreak(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return { type: null, count: 0, label: "-" };
  }

  const firstResult = Boolean(matches[0]?.won);
  let count = 0;

  for (const match of matches) {
    if (Boolean(match?.won) !== firstResult) break;
    count += 1;
  }

  return {
    type: firstResult ? "W" : "L",
    count,
    label: `${firstResult ? "W" : "L"}${count}`,
  };
}

function StatsPage() {
  const { slug } = useParams();

  const team = teams.find((item) => item.slug === slug) || null;
  const fallbackMatches = matchesData.filter(
    (match) => match.teamSlug === slug
  );

  const {
    matches: teamMatches,
    maps: liveMapStats,
    loading,
    error,
  } = useTeamStats(slug, fallbackMatches);

  const fallbackMapStats = Object.values(
    teamMatches.reduce((accumulator, match) => {
      const mapScores = Array.isArray(match.mapScores)
        ? match.mapScores
        : [];

      mapScores.forEach((map) => {
        const mapName = String(map.map || "").trim();
        if (!mapName) return;

        if (!accumulator[mapName]) {
          accumulator[mapName] = {
            name: mapName,
            played: 0,
            wins: 0,
          };
        }

        accumulator[mapName].played += 1;
        if (map.won) accumulator[mapName].wins += 1;
      });

      return accumulator;
    }, {})
  )
    .map((map) => ({
      ...map,
      losses: map.played - map.wins,
      winrate:
        map.played > 0
          ? Math.round((map.wins / map.played) * 100)
          : 0,
    }))
    .sort(
      (first, second) =>
        second.winrate - first.winrate ||
        second.played - first.played ||
        first.name.localeCompare(second.name)
    );

  const mapStats =
    Array.isArray(liveMapStats) && liveMapStats.length > 0
      ? liveMapStats
      : fallbackMapStats;

  const sortedMatches = [...teamMatches].sort(
    (first, second) =>
      new Date(second.date || 0).getTime() -
      new Date(first.date || 0).getTime()
  );

  const recentMatches = sortedMatches.slice(0, 10);
  const matchWins = sortedMatches.filter((match) => match.won).length;
  const matchLosses = sortedMatches.length - matchWins;
  const matchWinrate =
    sortedMatches.length > 0
      ? Math.round((matchWins / sortedMatches.length) * 100)
      : 0;

  const mapWins = mapStats.reduce(
    (sum, map) => sum + Number(map.wins || 0),
    0
  );
  const mapLosses = mapStats.reduce(
    (sum, map) => sum + Number(map.losses || 0),
    0
  );
  const mapsPlayed = mapWins + mapLosses;
  const mapWinrate =
    mapsPlayed > 0 ? Math.round((mapWins / mapsPlayed) * 100) : 0;
  const bestMap = mapStats.length > 0 ? mapStats[0] : null;
  const streak = getStreak(sortedMatches);

  if (!team) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080d13] p-8 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-black">Team not found</h1>
          <Link
            to="/"
            className="mt-4 inline-block text-orange-400 transition hover:text-orange-300"
          >
            ← Back Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#080d13] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <Link
          to={`/team/${slug}`}
          className="text-sm font-bold text-orange-400 transition hover:text-orange-300"
        >
          ← Back to Team
        </Link>

        <div className="mb-7 mt-3">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
            Team performance
          </div>
          <h1 className="mt-1 text-3xl font-black sm:text-4xl">
            {team.name} Statistics
          </h1>
        </div>

        {loading && (
          <div className="mb-5 text-sm text-slate-500">
            Loading automatic match and map statistics...
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-300">
            {error}. Saved match data is shown.
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#202c3a] bg-[#111923] p-5">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[#587094]">
              Matches
            </div>
            <div className="mt-3 text-3xl font-black">{sortedMatches.length}</div>
            <div className="mt-1 text-sm text-[#6e87ad]">
              {matchWins} wins · {matchLosses} losses
            </div>
          </div>

          <div className="rounded-2xl border border-[#202c3a] bg-[#111923] p-5">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[#587094]">
              Match win rate
            </div>
            <div className={`mt-3 text-3xl font-black ${getWinrateTextClass(matchWinrate)}`}>
              {matchWinrate}%
            </div>
            <div className="mt-1 text-sm text-[#6e87ad]">
              Across all completed matches
            </div>
          </div>

          <div className="rounded-2xl border border-[#202c3a] bg-[#111923] p-5">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[#587094]">
              Map win rate
            </div>
            <div className={`mt-3 text-3xl font-black ${getWinrateTextClass(mapWinrate)}`}>
              {mapWinrate}%
            </div>
            <div className="mt-1 text-sm text-[#6e87ad]">
              {mapsPlayed} maps played
            </div>
          </div>

          <div className="rounded-2xl border border-[#202c3a] bg-[#111923] p-5">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[#587094]">
              Current streak
            </div>
            <div
              className={`mt-3 text-3xl font-black ${
                streak.type === "W"
                  ? "text-emerald-400"
                  : streak.type === "L"
                    ? "text-rose-400"
                    : "text-slate-400"
              }`}
            >
              {streak.label}
            </div>
            <div className="mt-1 text-sm text-[#6e87ad]">
              Best map: {bestMap ? formatMapName(bestMap.name) : "-"}
            </div>
          </div>
        </section>

        <section className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.95fr)]">
          <div className="overflow-hidden rounded-3xl border border-[#202c3a] bg-[#111923]">
            <div className="flex flex-col gap-3 border-b border-white/5 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
                  Form
                </div>
                <h2 className="mt-1 text-2xl font-black">Last 10 matches</h2>
              </div>
              <div className="text-sm font-bold text-[#6e87ad]">
                {matchWins}W · {matchLosses}L overall
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {recentMatches.length > 0 ? (
                <>
                  <div className="mb-6 flex flex-wrap gap-2">
                    {recentMatches.map((match) => (
                      <Link
                        key={match.matchId || match.id}
                        to={`/match/${match.matchId || match.id}`}
                        title={`vs ${match.opponentName || "Unknown"}`}
                        className={`flex h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-black transition hover:-translate-y-0.5 ${
                          match.won
                            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-400 hover:border-emerald-400/60"
                            : "border-rose-500/35 bg-rose-500/10 text-rose-400 hover:border-rose-400/60"
                        }`}
                      >
                        {match.won ? "W" : "L"}
                      </Link>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {recentMatches.map((match) => {
                      const id = match.matchId || match.id;

                      return (
                        <Link
                          key={id}
                          to={`/match/${id}`}
                          className="group grid gap-3 rounded-xl border border-[#202c3a] bg-[#151e29] px-4 py-3 transition hover:border-orange-500/35 hover:bg-[#18222f] sm:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-black text-slate-100 transition group-hover:text-white">
                              vs {match.opponentName || "Unknown"}
                            </div>
                            <div className="mt-1 truncate text-xs text-[#587094]">
                              {formatDate(match.date)}
                              {match.season && (
                                <>
                                  {" · "}
                                  <TournamentNameLink name={match.season} />
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <div className="text-lg font-black">
                              {match.boScore ||
                                `${match.teamScore ?? 0} : ${match.opponentScore ?? 0}`}
                            </div>
                            <div
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-black uppercase ${
                                match.won
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-rose-500/10 text-rose-400"
                              }`}
                            >
                              {match.won ? "Win" : "Loss"}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : (
                !loading && (
                  <div className="py-14 text-center text-slate-500">
                    No completed matches found
                  </div>
                )
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[#202c3a] bg-[#111923]">
            <div className="flex items-end justify-between gap-4 border-b border-white/5 px-5 py-5 sm:px-6">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
                  Map record
                </div>
                <h2 className="mt-1 text-2xl font-black">Win rates by map</h2>
              </div>

              <div className="hidden text-right sm:block">
                <div className="text-sm font-black text-slate-200">
                  {mapWins}-{mapLosses}
                </div>
                <div className="text-xs text-[#587094]">Overall map balance</div>
              </div>
            </div>

            {mapStats.length > 0 ? (
              <div className="divide-y divide-white/5">
                {mapStats.map((map) => {
                  const imageName = normalizeMapImageName(map.name);
                  const safeWinrate = Math.max(
                    0,
                    Math.min(100, Number(map.winrate || 0))
                  );

                  return (
                    <Link
                      key={map.name}
                      to={`/team/${slug}/matches?map=${encodeURIComponent(map.name)}`}
                      className="group relative grid min-h-[94px] overflow-hidden px-4 py-4 transition hover:bg-white/[0.035] sm:grid-cols-[120px_minmax(0,1fr)_72px] sm:items-center sm:gap-4"
                    >
                      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/[0.06] to-transparent" />
                      </div>

                      <div className="relative mb-3 h-20 overflow-hidden rounded-xl border border-white/10 sm:mb-0 sm:h-16">
                        <img
                          src={`/maps/${imageName}.png`}
                          alt={`${formatMapName(map.name)} map`}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-black/60" />
                        <div className="absolute inset-x-0 bottom-0 px-3 py-2 text-sm font-black drop-shadow">
                          {formatMapName(map.name)}
                        </div>
                      </div>

                      <div className="relative min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-bold text-slate-200">
                            {map.played} {Number(map.played) === 1 ? "map" : "maps"}
                          </div>
                          <div className="text-xs text-[#6e87ad]">
                            <span className="text-emerald-400">{map.wins}W</span>
                            {" · "}
                            <span className="text-rose-400">{map.losses}L</span>
                          </div>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#080d13]">
                          <div
                            className="h-full rounded-full bg-orange-500 transition-all duration-500 group-hover:bg-orange-400"
                            style={{ width: `${safeWinrate}%` }}
                          />
                        </div>
                      </div>

                      <div className="relative mt-3 flex items-center justify-between sm:mt-0 sm:block sm:text-right">
                        <div className={`text-2xl font-black ${getWinrateTextClass(safeWinrate)}`}>
                          {safeWinrate}%
                        </div>
                        <div className="text-xs font-semibold text-[#587094] transition group-hover:text-orange-300">
                          View matches →
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              !loading && (
                <div className="px-6 py-16 text-center text-slate-500">
                  Map statistics will appear after completed matches with map data.
                </div>
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default StatsPage;