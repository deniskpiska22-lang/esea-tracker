import Link from "../components/SiteLink.jsx";
import { findTeamByRoute } from "../utils/teamProfileUrls.js";
import { translateError } from "../i18n/translate.js";
import { tx, translateMatchStatus } from "../i18n/translate.js";
import { currentLocale } from "../i18n/languages.js";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { useTeamCatalog } from "../hooks/useTeamCatalog.js";
import { supabase } from "../lib/supabaseClient";
import TournamentNameLink from "../components/TournamentNameLink";

import { loadTeamMatchFeed, matchKind, compareUpcomingMatches, teamIsFirstInMatch } from "../utils/teamMatchFeed.js";
import { formatUserDateTime } from "../utils/userTime.js";

function normalizeCompetitionKey(value = "") {
  return String(value || "ESEA League")
    .normalize("NFKC")
    .trim()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}



function formatDate(value) {
  if (!value) return tx("Unknown date");

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(currentLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getMapScores(row) {
  const value = row.map_scores || row.maps || row.map_results || [];

  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value
        .split(",")
        .map((map) => map.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function getMapNames(row) {
  return getMapScores(row)
    .map((map) => {
      if (typeof map === "string") return map;
      return map.map || map.mapName || map.name || null;
    })
    .filter(Boolean);
}

function rowToTeamMatch(row, team) {
  const teamIsFirst = teamIsFirstInMatch(row, team);

  const ownScoreRaw =
    teamIsFirst ? row.team1_score : row.team2_score;

  const opponentScoreRaw =
    teamIsFirst ? row.team2_score : row.team1_score;

  const ownScore =
    ownScoreRaw === null || ownScoreRaw === undefined
      ? null
      : Number(ownScoreRaw);

  const opponentScore =
    opponentScoreRaw === null || opponentScoreRaw === undefined
      ? null
      : Number(opponentScoreRaw);

  const hasScores =
    Number.isFinite(ownScore) &&
    Number.isFinite(opponentScore);

  const kind = matchKind(row);
  const showScore = hasScores && kind !== "upcoming";
  const won = showScore && ownScore > opponentScore;
  const draw = hasScores && ownScore === opponentScore;

  return {
    id: row.id,
    kind,
    status: row.status,
    bestOf: row.best_of,
    opponentLogo: (teamIsFirst ? row.team2_logo : row.team1_logo) || null,
    matchId: row.id,
    season: row.competition_name || row.season || "ESEA League",
    date: formatDate(row.finished_at || row.scheduled_at),
    timestamp: row.finished_at || row.scheduled_at || row.started_at || "",
    opponentName:
      (teamIsFirst ? row.team2_name : row.team1_name) || "Unknown",
    maps: getMapNames(row),
    mapScores: getMapScores(row),
    boScore: showScore ? `${ownScore}:${opponentScore}` : "-:-",
    result: !showScore ? "-" : draw ? "D" : won ? tx("W") : tx("L"),
  };
}

function TeamMatches({ team, slug }) {
  const location = useLocation();
  const mapFilter = new URLSearchParams(location.search).get("map");

  const [databaseRows, setDatabaseRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let latestRequest = 0;
    let reloadTimer;

    const loadMatches = async () => {
      if (slug && !team) { setDatabaseRows([]); setLoading(false); return; }
      if (!supabase) {
        if (!cancelled) {
          setErrorMessage("Supabase client is not configured");
          setLoading(false);
        }
        return;
      }

      if (!team) {
        if (!cancelled) {
          setErrorMessage("Team not found");
          setLoading(false);
        }
        return;
      }

      const request = ++latestRequest;
      let response;
      try {
        response = await loadTeamMatchFeed(supabase, team);
      } catch (error) {
        response = { error };
      }
      const { data, error } = response;

      if (cancelled || request !== latestRequest) return;

      if (error) {
        console.error("Team matches error:", error);
        setErrorMessage(error.message);
      } else {
        setDatabaseRows(data || []);
        setErrorMessage("");
      }

      setLoading(false);
    };

    loadMatches();

    const scheduleReload = () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(loadMatches, 300);
    };
    const pollTimer = setInterval(() => {
      if (!document.hidden) loadMatches();
    }, 60000);
    window.addEventListener("focus", scheduleReload);

    const channel = supabase
      ? supabase
          .channel(`team-matches-${slug}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "matches",
            },
            (payload) => {
              const row = payload.new?.id ? payload.new : payload.old;
              if (!row?.team1_id || !team?.faceitTeamId ||
                  row.team1_id === team.faceitTeamId || row.team2_id === team.faceitTeamId) {
                scheduleReload();
              }
            }
          )
          .subscribe()
      : null;

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      clearTimeout(reloadTimer);
      window.removeEventListener("focus", scheduleReload);

      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [slug, team]);

  const teamMatches = useMemo(() => {
    return databaseRows
      .filter((row) => matchKind(row) === "finished")
      .map((row) => rowToTeamMatch(row, team))
      .filter((match) => {
        if (!mapFilter) return true;

        return match.maps.some(
          (map) =>
            String(map || "").toLowerCase() ===
            String(mapFilter || "").toLowerCase()
        );
      })
      .sort(
        (first, second) =>
          new Date(second.timestamp) - new Date(first.timestamp)
      );
  }, [databaseRows, mapFilter, team]);

  const upcomingGroups = useMemo(() => {
    const rows = databaseRows.filter((row) => ["live", "upcoming"].includes(matchKind(row)))
      .sort(compareUpcomingMatches);
    const groups = new Map();
    for (const row of rows) {
      const match = rowToTeamMatch(row, team);
      const key = normalizeCompetitionKey(match.season);
      if (!groups.has(key)) groups.set(key, { season: match.season, matches: [] });
      groups.get(key).matches.push(match);
    }
    return [...groups.values()];
  }, [databaseRows, team]);

  const groupedMatches = useMemo(() => {
    const groups = teamMatches.reduce((result, match) => {
      const competitionKey = normalizeCompetitionKey(match.season);

      if (!result[competitionKey]) {
        result[competitionKey] = {
          season: String(match.season || "ESEA League").trim(),
          matches: [],
        };
      }

      result[competitionKey].matches.push(match);
      return result;
    }, {});

    return Object.values(groups)
      .map(({ season, matches }) => ({
        season,
        matches: [...matches].sort(
          (first, second) =>
            new Date(second.timestamp) -
            new Date(first.timestamp)
        ),
      }))
      .sort(
        (first, second) =>
          new Date(second.matches[0]?.timestamp || 0) -
          new Date(first.matches[0]?.timestamp || 0)
      );
  }, [teamMatches]);

  return (
    <div className="min-h-screen bg-[#0b0f14] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          to={`/teams/${slug}`}
          className="text-orange-400 hover:text-orange-300"
        >{tx(" ← Back to Team ")}</Link>

        <h1 className="mb-8 mt-4 text-4xl font-black">
          {team?.name || tx("Team")}{tx(" Matches ")}</h1>

        {mapFilter && (
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-full bg-orange-500/20 px-3 py-1 text-orange-400">
              {mapFilter}
            </span>

            <Link
              to={`/teams/${slug}/matches`}
              className="text-gray-400 hover:text-white"
            >{tx(" Clear Filter ")}</Link>
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-[#243041] bg-[#111823] p-8 text-center text-gray-400">{tx(" Loading matches... ")}</div>
        )}

        {!loading && errorMessage && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">{tx(" Could not load matches from Supabase: ")}{translateError(errorMessage)}
          </div>
        )}

        {!loading && !errorMessage && (
          <section className="mb-10" aria-labelledby="upcoming-team-matches">
            <h2 id="upcoming-team-matches" className="mb-5 text-2xl font-black">{tx("Upcoming Matches")}</h2>
            {upcomingGroups.length === 0 && (
              <p className="rounded-xl border border-[#243041] bg-[#111823] p-6 text-sm text-slate-400">{tx("No upcoming matches scheduled.")}</p>
            )}
            <div className="space-y-5">
              {upcomingGroups.map(({ season, matches }) => (
                <div key={season} className="overflow-hidden rounded-xl border border-[#243041] bg-[#111823]">
                  <h3 className="border-b border-[#243041] bg-[#1a2330] px-4 py-3 text-sm font-bold sm:px-6">
                    <TournamentNameLink name={season} />
                  </h3>
                  <div className="divide-y divide-white/[0.06]">
                    {matches.map((match) => (
                      <Link key={match.id} to={`/teams/${slug}/matches/${match.id}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-orange-400 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:px-6">
                        <div className="text-xs text-slate-400 sm:text-sm">
                          {match.kind === "live" && <span className="mb-1 block font-bold text-red-400">● {translateMatchStatus(match.status)}</span>}
                          <time dateTime={match.timestamp || undefined} className="block">
                            {formatUserDateTime(match.timestamp, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) || tx("Date TBD")}
                          </time>
                        </div>
                        <div className="col-start-1 row-start-2 flex min-w-0 items-center gap-3 sm:col-start-2 sm:row-start-1">
                          <span className="text-xs font-bold text-slate-500">VS</span>
                          {match.opponentLogo && <img src={match.opponentLogo} alt="" className="h-7 w-7 shrink-0 object-contain" loading="lazy" />}
                          <span className="min-w-0 break-words text-sm font-bold sm:text-base">{match.opponentName}</span>
                        </div>
                        <div className="col-start-2 row-span-2 row-start-1 text-right sm:col-start-3 sm:row-span-1">
                          <div className={match.kind === "live" ? "font-black text-red-400" : "font-black text-slate-500"}>{match.kind === "live" ? match.boScore : "– : –"}</div>
                          <div className="mt-1 text-xs text-orange-400">{match.bestOf ? `BO${match.bestOf} · ` : ""}{tx("Match")} ↗</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && !errorMessage && <h2 className="mb-5 text-2xl font-black">{tx("Recent Results")}</h2>}

        {!loading && !errorMessage && teamMatches.length === 0 && (
          <div className="rounded-xl border border-[#243041] bg-[#111823] p-8 text-center text-gray-400">{tx(" This team does not have any completed matches in the database yet. ")}</div>
        )}

        {!loading &&
          !errorMessage &&
          groupedMatches.map(({ season, matches }) => (
            <div key={season} className="mb-10">
              <div className="mb-4 rounded-xl bg-[#1a2330] p-4">
                <h2 className="text-xl font-bold">
                  <TournamentNameLink name={season} />
                </h2>
              </div>

              <div className="space-y-3">
                {matches.map((match) => (
                  <Link
                    key={match.matchId}
                    to={`/teams/${slug}/matches/${match.matchId}`}
                    className="flex flex-wrap items-center justify-between gap-y-3 rounded-xl border border-[#243041] bg-[#111823] px-6 py-4 transition-all duration-300 hover:translate-x-1 hover:border-orange-500/50 hover:shadow-[0_10px_30px_rgba(249,115,22,0.12)]"
                  >
                    <div className="flex min-w-[180px] items-center gap-6">
                      <span
                        className={`text-lg font-bold ${
                          match.result === "W"
                            ? "text-green-400"
                            : match.result === "L"
                            ? "text-red-400"
                            : "text-gray-400"
                        }`}
                      >
                        {match.result}
                      </span>

                      <span className="text-gray-500">{match.date}</span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 px-3 sm:px-8">
                      <div className="text-lg font-bold text-white">
                        VS {match.opponentName}
                      </div>

                      <div className="text-sm text-gray-400">
                        {match.maps.length > 0
                          ? match.maps.join(" • ")
                          : tx("Maps unavailable")}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-black text-white">
                        {match.boScore}
                      </div>

                      <span className="text-lg text-orange-400">↗</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function MatchesPage() {
  const { teams } = useTeamCatalog();
  const { slug } = useParams();
  const team = findTeamByRoute(teams, slug);
  return <TeamMatches key={team?.faceitTeamId || slug} team={team} slug={slug} />;
}

export default MatchesPage;
