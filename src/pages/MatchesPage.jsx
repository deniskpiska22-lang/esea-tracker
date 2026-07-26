import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import teams from "../data/teams";
import { supabase } from "../lib/supabaseClient";
import TournamentNameLink from "../components/TournamentNameLink";

const FINISHED_STATUSES = ["FINISHED", "MATCH_STATUS_FINISHED"];

function getSeasonNumber(value = "") {
  const normalized = String(value).toLowerCase();

  const patterns = [
    /(?:season|сезон)\s*#?\s*(\d{1,3})/i,
    /\bs\s*[-#]?\s*(\d{1,3})\b/i,
    /\bs(\d{1,3})\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  return 0;
}

function getStagePriority(value = "") {
  const normalized = String(value).toLowerCase();

  if (
    normalized.includes("final") ||
    normalized.includes("финал")
  ) {
    return 500;
  }

  if (
    normalized.includes("playoff") ||
    normalized.includes("play-off") ||
    normalized.includes("плей-офф") ||
    normalized.includes("плей офф")
  ) {
    return 400;
  }

  if (
    normalized.includes("relegation") ||
    normalized.includes("demotion")
  ) {
    return 300;
  }

  if (
    normalized.includes("regular") ||
    normalized.includes("group") ||
    normalized.includes("групп")
  ) {
    return 200;
  }

  return 100;
}

function compareSeasons(firstSeason, secondSeason) {
  const seasonDifference =
    getSeasonNumber(secondSeason) -
    getSeasonNumber(firstSeason);

  if (seasonDifference !== 0) {
    return seasonDifference;
  }

  const stageDifference =
    getStagePriority(secondSeason) -
    getStagePriority(firstSeason);

  if (stageDifference !== 0) {
    return stageDifference;
  }

  return String(secondSeason).localeCompare(
    String(firstSeason),
    "ru",
    {
      numeric: true,
      sensitivity: "base",
    }
  );
}

function normalizeName(value = "") {
  return String(value || "")
    .replace(/\s+/g, "")
    .toLowerCase();
}



function formatDate(value) {
  if (!value) return "Unknown date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ru-RU", {
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
  const teamIsFirst =
    (team?.faceitTeamId && row.team1_id === team.faceitTeamId) ||
    row.team1_slug === team?.slug ||
    normalizeName(row.team1_name) === normalizeName(team?.name);

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

  const won = hasScores && ownScore > opponentScore;
  const draw = hasScores && ownScore === opponentScore;

  return {
    id: row.id,
    matchId: row.id,
    season: row.competition_name || row.season || "ESEA League",
    date: formatDate(row.finished_at || row.scheduled_at),
    timestamp: row.finished_at || row.scheduled_at || "",
    opponentName:
      (teamIsFirst ? row.team2_name : row.team1_name) || "Unknown",
    maps: getMapNames(row),
    mapScores: getMapScores(row),
    boScore: hasScores ? `${ownScore}:${opponentScore}` : "-:-",
    result: !hasScores ? "-" : draw ? "D" : won ? "W" : "L",
  };
}

function MatchesPage() {
  const { slug } = useParams();
  const location = useLocation();

  const mapFilter = new URLSearchParams(location.search).get("map");
  const team = teams.find((item) => item.slug === slug);

  const [databaseRows, setDatabaseRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadMatches = async () => {
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

      const filters = [];

      if (team.slug) {
        filters.push(`team1_slug.eq.${team.slug}`);
        filters.push(`team2_slug.eq.${team.slug}`);
      }

      if (team.faceitTeamId) {
        filters.push(`team1_id.eq.${team.faceitTeamId}`);
        filters.push(`team2_id.eq.${team.faceitTeamId}`);
      }

      /*
       * По имени не фильтруем через .or():
       * пробелы, запятые и спецсимволы в названии
       * команды могут ломать PostgREST-выражение.
       * slug и FACEIT team id надёжнее.
       */
      if (filters.length === 0 && team.name) {
        const safeName = String(team.name)
          .replace(/"/g, '\\"');

        filters.push(`team1_name.eq."${safeName}"`);
        filters.push(`team2_name.eq."${safeName}"`);
      }

      let query = supabase
        .from("matches")
        .select("*")
        .in("status", FINISHED_STATUSES)
        .order("finished_at", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(250);

      if (filters.length > 0) {
        query = query.or(filters.join(","));
      }

      const { data, error } = await query;

      if (cancelled) return;

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

    const intervalId = window.setInterval(loadMatches, 30000);

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
            loadMatches
          )
          .subscribe()
      : null;

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);

      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [slug, team]);

  const teamMatches = useMemo(() => {
    return databaseRows
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

  const groupedMatches = useMemo(() => {
    const groups = teamMatches.reduce((result, match) => {
      if (!result[match.season]) {
        result[match.season] = [];
      }

      result[match.season].push(match);
      return result;
    }, {});

    return Object.entries(groups)
      .sort(([firstSeason], [secondSeason]) =>
        compareSeasons(firstSeason, secondSeason)
      )
      .map(([season, matches]) => ({
        season,
        matches: [...matches].sort(
          (first, second) =>
            new Date(second.timestamp) -
            new Date(first.timestamp)
        ),
      }));
  }, [teamMatches]);

  return (
    <div className="min-h-screen bg-[#0b0f14] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          to={`/team/${slug}`}
          className="text-orange-400 hover:text-orange-300"
        >
          ← Back to Team
        </Link>

        <h1 className="mb-8 mt-4 text-4xl font-black">
          {team?.name || "Team"} Matches
        </h1>

        {mapFilter && (
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-full bg-orange-500/20 px-3 py-1 text-orange-400">
              {mapFilter}
            </span>

            <Link
              to={`/team/${slug}/matches`}
              className="text-gray-400 hover:text-white"
            >
              Clear Filter
            </Link>
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-[#243041] bg-[#111823] p-8 text-center text-gray-400">
            Loading matches...
          </div>
        )}

        {!loading && errorMessage && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
            Could not load matches from Supabase: {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && teamMatches.length === 0 && (
          <div className="rounded-xl border border-[#243041] bg-[#111823] p-8 text-center text-gray-400">
            This team does not have any completed matches in the database yet.
          </div>
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
                    to={`/team/${slug}/matches/${match.matchId}`}
                    className="flex items-center justify-between rounded-xl border border-[#243041] bg-[#111823] px-6 py-4 transition-all duration-300 hover:translate-x-1 hover:border-orange-500/50 hover:shadow-[0_10px_30px_rgba(249,115,22,0.12)]"
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

                    <div className="flex flex-1 items-center justify-between px-8">
                      <div className="text-lg font-bold text-white">
                        VS {match.opponentName}
                      </div>

                      <div className="text-sm text-gray-400">
                        {match.maps.length > 0
                          ? match.maps.join(" • ")
                          : "Maps unavailable"}
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

export default MatchesPage;