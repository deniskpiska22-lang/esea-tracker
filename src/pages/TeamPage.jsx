import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, Link } from "react-router-dom";
import teams from "../data/teams";
import matchesData from "../data/matches";
import { useTeamStats } from "../hooks/useTeamStats";
import TeamRosterSection from "../components/TeamRosterSection";
import { supabase } from "../lib/supabaseClient";
import { resolveRatingRow } from "../utils/resolveTeamRating";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// Flip to true once the Analytics page has real content to show.
const SHOW_ANALYTICS_TAB = false;

// Public intake form for team descriptions/player photos — reviewed and
// published by an admin via /admin/verifications (Teams tab), not automatic.
const TEAM_VERIFICATION_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfWHCf0KLD7z49ds6j4Ua-H_aTDiUOYZdAhlNmH5jc2aTUxvg/viewform";

const COUNTRY_NAMES = {
  RU: "Russia",
  US: "United States",
  CA: "Canada",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  PE: "Peru",
  MX: "Mexico",
  GB: "United Kingdom",
  UA: "Ukraine",
  PL: "Poland",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  PT: "Portugal",
  IT: "Italy",
  NL: "Netherlands",
  BE: "Belgium",
  DK: "Denmark",
  SE: "Sweden",
  NO: "Norway",
  FI: "Finland",
  CZ: "Czechia",
  SK: "Slovakia",
  RO: "Romania",
  BG: "Bulgaria",
  RS: "Serbia",
  HR: "Croatia",
  HU: "Hungary",
  TR: "Türkiye",
  KZ: "Kazakhstan",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  AU: "Australia",
  NZ: "New Zealand",
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeCountry(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();

  if (raw.length === 2) {
    return raw;
  }

  const aliases = {
    RUSSIA: "RU",
    RUSSIAN: "RU",
    USA: "US",
    "UNITED STATES": "US",
    UK: "GB",
    "UNITED KINGDOM": "GB",
    UKRAINE: "UA",
    POLAND: "PL",
    GERMANY: "DE",
    FRANCE: "FR",
    SPAIN: "ES",
    PORTUGAL: "PT",
    BRAZIL: "BR",
    CANADA: "CA",
    AUSTRALIA: "AU",
    KAZAKHSTAN: "KZ",
  };

  return aliases[raw] || raw || null;
}

function getRatingValue(row) {
  const candidates = [
    row?.rating,
    row?.points,
    row?.elo,
    row?.score,
    row?.current_rating,
    row?.current_points,
  ];

  for (const value of candidates) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function getRankingTeamId(row) {
  return (
    row?.team_id ||
    row?.faceit_team_id ||
    row?.faceitTeamId ||
    row?.id ||
    null
  );
}

function getRankingTeamName(row) {
  return (
    row?.team_name ||
    row?.name ||
    row?.team ||
    ""
  );
}

function findLocalTeamForRankingRow(row) {
  const rowId = getRankingTeamId(row);
  const rowName = normalizeText(
    getRankingTeamName(row)
  );

  return teams.find((candidate) => {
    const candidateIds = [
      candidate?.faceitTeamId,
      candidate?.faceit_team_id,
      candidate?.teamId,
      candidate?.id,
    ]
      .filter(Boolean)
      .map(String);

    if (
      rowId &&
      candidateIds.includes(String(rowId))
    ) {
      return true;
    }

    return (
      rowName &&
      normalizeText(candidate?.name) === rowName
    );
  });
}

function getRankingCountry(row) {
  const directCountry = normalizeCountry(
    row?.country ||
    row?.country_code ||
    row?.countryCode
  );

  if (directCountry) {
    return directCountry;
  }

  const localTeam =
    findLocalTeamForRankingRow(row);

  return normalizeCountry(
    localTeam?.country ||
    localTeam?.countryCode ||
    localTeam?.country_code
  );
}

function getRankingRowDivision(row) {
  return normalizeText(row?.division || "");
}

function getRankChange(row, type) {
  const candidates =
    type === "world"
      ? [
          row?.world_rank_change,
          row?.rank_change,
          row?.position_change,
          row?.places_change,
        ]
      : [
          row?.country_rank_change,
          row?.national_rank_change,
        ];

  for (const value of candidates) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function RankChange({ value }) {
  if (!Number.isFinite(value) || value === 0) {
    return null;
  }

  const improved = value > 0;

  return (
    <span
      className={[
        "rounded-md px-2 py-1 text-[10px] font-black",
        improved
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-rose-500/10 text-rose-400",
      ].join(" ")}
    >
      {improved ? "▲" : "▼"}{" "}
      {Math.abs(value)}
    </span>
  );
}

function RankCard({
  eyebrow,
  rank,
  countryCode,
  change,
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-black/15 p-4 backdrop-blur-sm">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/55 to-transparent" />

      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
          {eyebrow}
        </div>

        <RankChange value={change} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="text-4xl font-black tracking-tight text-white">
          {rank ? `#${rank}` : "—"}
        </div>

        {countryCode && (
          <div className="text-sm font-black text-slate-500">
            {countryCode}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamPage() {
  const { slug } = useParams();

  const team = teams?.find(
    (item) => item.slug === slug
  );

  const [rankingRows, setRankingRows] =
    useState([]);
  const [rankingLoading, setRankingLoading] =
    useState(true);
  const [rankingError, setRankingError] =
    useState(null);

  const [
    ratingHistoryRows,
    setRatingHistoryRows,
  ] = useState([]);

  const [
    ratingHistoryLoading,
    setRatingHistoryLoading,
  ] = useState(true);

  const [teamDescription, setTeamDescription] =
    useState(null);
  const [teamSocialLinks, setTeamSocialLinks] =
    useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadRankings() {
      setRankingLoading(true);
      setRankingError(null);

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

      if (cancelled) {
        return;
      }

      if (error) {
        setRankingRows([]);
        setRankingError(error.message);
      } else {
        setRankingRows(allRows);
      }

      setRankingLoading(false);
    }

    loadRankings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRatingHistory() {
      const teamId =
        team?.faceitTeamId ||
        team?.faceit_team_id ||
        team?.teamId ||
        team?.id ||
        null;

      if (!teamId) {
        setRatingHistoryRows([]);
        setRatingHistoryLoading(false);
        return;
      }

      setRatingHistoryLoading(true);

      const { data, error } = await supabase
        .from("team_rating_history")
        .select(
          "team_id,points,world_rank,matches_played,week_start,created_at"
        )
        .eq("team_id", String(teamId))
        .eq("snapshot_type", "weekly")
        .order("week_start", {
          ascending: true,
        })
        .limit(104);

      if (cancelled) {
        return;
      }

      if (error) {
        console.warn(
          "Rating history load failed:",
          error.message
        );
        setRatingHistoryRows([]);
      } else {
        setRatingHistoryRows(data || []);
      }

      setRatingHistoryLoading(false);
    }

    loadRatingHistory();

    return () => {
      cancelled = true;
    };
  }, [slug, team]);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamProfile() {
      const teamId =
        team?.faceitTeamId ||
        team?.faceit_team_id ||
        team?.teamId ||
        team?.id ||
        null;

      if (!teamId) {
        setTeamDescription(null);
        setTeamSocialLinks([]);
        return;
      }

      const { data, error } = await supabase
        .from("team_profiles")
        .select("description,social_links")
        .eq("team_id", String(teamId))
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        console.warn(
          "Team profile load failed:",
          error.message
        );
        setTeamDescription(null);
        setTeamSocialLinks([]);
      } else {
        setTeamDescription(
          data?.description?.trim() || null
        );
        setTeamSocialLinks(
          Array.isArray(data?.social_links)
            ? data.social_links
            : []
        );
      }
    }

    loadTeamProfile();

    return () => {
      cancelled = true;
    };
  }, [slug, team]);

  if (!team) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080b10] px-4 text-white">
        <div className="rounded-3xl border border-white/[0.06] bg-[#101720] px-10 py-14 text-center">
          <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-400">
            ESEA Tracker
          </div>

          <h1 className="mt-3 text-3xl font-black text-white">
            Team not found
          </h1>

          <Link
            to="/rankings"
            className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-2.5 font-black text-white transition hover:bg-orange-400"
          >
            Back to rankings
          </Link>
        </div>
      </div>
    );
  }

  const teamHistory =
    ratingHistoryRows.map((row) => {
      const dateValue =
        row.week_start ||
        row.created_at;

      const date =
        new Date(dateValue);

      return {
        week:
          Number.isNaN(date.getTime())
            ? String(dateValue || "")
            : date.toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                }
              ),
        rating:
          Number(row.points || 0),
        rank:
          row.world_rank
            ? Number(row.world_rank)
            : null,
        matchesPlayed:
          Number(
            row.matches_played || 0
          ),
      };
    });

  const fallbackMatches = matchesData
    .filter(
      (match) => match.teamSlug === slug
    )
    .sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    );

  const {
    matches: teamMatches = [],
  } = useTeamStats(
    slug,
    fallbackMatches
  );

  const wins = teamMatches.filter(
    (match) =>
      match.won === true ||
      String(match.result).toUpperCase() ===
        "WIN"
  ).length;

  const losses = teamMatches.filter(
    (match) =>
      match.won === false ||
      String(match.result).toUpperCase() ===
        "LOSS"
  ).length;

  const total = wins + losses;

  const winrate =
    total > 0
      ? Math.round((wins / total) * 100)
      : 0;

  const recentForm =
    teamMatches.slice(0, 5);

  const rankingData = useMemo(() => {
    const sortedWorld = [...rankingRows]
      .filter(
        (row) =>
          getRatingValue(row) > 0
      )
      .sort(
        (first, second) =>
          getRatingValue(second) -
          getRatingValue(first)
      );

    const rowIdentities = sortedWorld.map(
      (row) => ({
        row,
        ids: [getRankingTeamId(row)]
          .filter(Boolean)
          .map(String),
        slug: normalizeText(row?.slug || ""),
        name: normalizeText(
          getRankingTeamName(row)
        ),
        division: getRankingRowDivision(row),
      })
    );

    const currentRow = resolveRatingRow(
      {
        ids: [
          team?.faceitTeamId,
          team?.faceit_team_id,
          team?.teamId,
          team?.id,
        ],
        slug: normalizeText(team?.slug || ""),
        name: normalizeText(team?.name),
        division: normalizeText(
          team?.division || ""
        ),
      },
      rowIdentities
    );

    const worldIndex =
      currentRow
        ? sortedWorld.indexOf(currentRow)
        : -1;

    const teamCountry =
      getRankingCountry(currentRow) ||
      normalizeCountry(
        team.country ||
        team.countryCode ||
        team.country_code ||
        team.nationality
      );

    const countryRows = teamCountry
      ? sortedWorld.filter((row) => {
          const rowCountry =
            getRankingCountry(row);

          return rowCountry === teamCountry;
        })
      : [];

    const countryIndex =
      currentRow
        ? countryRows.indexOf(currentRow)
        : -1;

    return {
      row: currentRow,
      rating:
        getRatingValue(currentRow),
      worldRank:
        worldIndex >= 0
          ? worldIndex + 1
          : null,
      countryRank:
        countryIndex >= 0
          ? countryIndex + 1
          : null,
      countryCode: teamCountry,
      countryName:
        COUNTRY_NAMES[teamCountry] ||
        teamCountry ||
        "Country",
      worldRankChange:
        getRankChange(
          currentRow,
          "world"
        ),
      countryRankChange:
        getRankChange(
          currentRow,
          "country"
        ),
    };
  }, [rankingRows, team]);

  const currentRating =
    rankingData.rating ||
    Number(team.points) ||
    0;

  return (
    <div className="min-h-screen bg-[#080b10] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl">

        {/* HERO */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/[0.06] bg-gradient-to-br from-[#111821] via-[#0f151e] to-[#0b1017] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full bg-orange-400/[0.06] blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/80 to-transparent" />

          {team.logo && (
            <img
              src={team.logo}
              alt=""
              className="pointer-events-none absolute -right-16 top-1/2 h-[390px] w-[390px] -translate-y-1/2 scale-110 object-contain opacity-[0.045] grayscale"
            />
          )}

          <div className="relative p-6 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">

              <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
                <div
  className="
    group
    relative
    h-36
    w-36
    shrink-0
    overflow-hidden
    rounded-[28px]
    bg-[#0b1119]
    shadow-[0_12px_35px_rgba(0,0,0,0.30)]
  "
>
  <img
    src={team.logo}
    alt={team.name}
    className="
      absolute
      inset-0
      h-full
      w-full
      scale-[1.04]
      object-cover
      transition
      duration-300
      group-hover:scale-[1.08]
    "
  />

  <div
    className="
      pointer-events-none
      absolute
      inset-0
      rounded-[28px]
      ring-1
      ring-inset
      ring-white/[0.06]
    "
  />
</div>

                <div className="min-w-0 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
                    {team.flag && (
                      <img
                        src={team.flag}
                        alt=""
                        className="h-6 w-8 rounded-sm object-cover"
                      />
                    )}

                    <span className="rounded-lg border border-orange-500/15 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-orange-400">
                      {team.division || "Division"}
                    </span>
                  </div>

                  <h1 className="mt-3 truncate text-4xl font-black tracking-tight text-white md:text-6xl">
                    {team.name}
                  </h1>

                  <a
                    href={TEAM_VERIFICATION_FORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-orange-300 transition hover:bg-orange-500 hover:text-white"
                  >
                    Verification
                  </a>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                    <div className="rounded-xl border border-orange-500/15 bg-orange-500/[0.08] px-4 py-2">
                      <span className="text-sm text-slate-500">
                        Site rating
                      </span>

                      <span className="ml-2 text-lg font-black text-orange-400">
                        {rankingLoading
                          ? "..."
                          : currentRating || "—"}
                      </span>
                    </div>

                    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.07] px-4 py-2">
                      <span className="text-sm text-slate-500">
                        Win rate
                      </span>

                      <span className="ml-2 text-lg font-black text-emerald-400">
                        {winrate}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-3">
                  <RankCard
                    eyebrow="World rank"
                    rank={
                      rankingLoading
                        ? null
                        : rankingData.worldRank
                    }
                    change={
                      rankingData.worldRankChange
                    }
                  />

                  <RankCard
                    eyebrow={`${rankingData.countryName} rank`}
                    rank={
                      rankingLoading
                        ? null
                        : rankingData.countryRank
                    }
                    countryCode={
                      rankingData.countryCode
                    }
                    change={
                      rankingData.countryRankChange
                    }
                  />
                </div>

                {rankingError && (
                  <div className="mt-2 text-right text-[10px] text-rose-400">
                    Ranking data unavailable
                  </div>
                )}

                <div className="mt-3 rounded-2xl border border-white/[0.06] bg-black/10 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                      Last 5
                    </div>

                    <Link
                      to="/rankings"
                      className="text-[10px] font-black uppercase tracking-[0.15em] text-orange-400 transition hover:text-orange-300"
                    >
                      Full rankings
                    </Link>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {recentForm.length ? (
                      recentForm.map(
                        (match, index) => {
                          const won =
                            match.won === true ||
                            String(
                              match.result
                            ).toUpperCase() ===
                              "WIN";

                          return (
                            <div
                              key={
                                match.id ??
                                index
                              }
                              className={[
                                "flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-black",
                                won
                                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                                  : "border-rose-500/25 bg-rose-500/10 text-rose-400",
                              ].join(" ")}
                            >
                              {won ? "W" : "L"}
                            </div>
                          );
                        }
                      )
                    ) : (
                      <span className="text-sm text-slate-600">
                        No matches
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                {
                  label: "Wins",
                  value: wins,
                  cls: "text-emerald-400",
                },
                {
                  label: "Losses",
                  value: losses,
                  cls: "text-rose-400",
                },
                {
                  label: "Win rate",
                  value: `${winrate}%`,
                  cls: "text-orange-400",
                },
                {
                  label: "Site rating",
                  value:
                    rankingLoading
                      ? "..."
                      : currentRating || "—",
                  cls: "text-white",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5 transition hover:-translate-y-0.5 hover:border-orange-500/20 hover:bg-white/[0.035]"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent opacity-0 transition group-hover:opacity-100" />

                  <p className="text-sm font-medium text-slate-500">
                    {item.label}
                  </p>

                  <p
                    className={`mt-2 text-3xl font-black ${item.cls}`}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* NAVIGATION */}
        <nav className="mt-7 overflow-x-auto border-b border-white/[0.07]">
          <div className="flex min-w-max gap-8">
            <Link
              to={`/teams/${slug}`}
              className="relative pb-4 text-sm font-black text-white"
            >
              Overview
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-orange-500" />
            </Link>

            <Link
              to={`/teams/${slug}/matches`}
              className="pb-4 text-sm font-bold text-slate-500 transition hover:text-white"
            >
              Matches
            </Link>

            

            <Link
              to={`/teams/${slug}/stats`}
              className="pb-4 text-sm font-bold text-slate-500 transition hover:text-white"
            >
              Statistics
            </Link>

            <Link
              to={`/teams/${slug}/veto`}
              className="pb-4 text-sm font-bold text-slate-500 transition hover:text-white"
            >
              Veto
            </Link>

            {SHOW_ANALYTICS_TAB && (
              <Link
                to={`/teams/${slug}/analytics`}
                className="pb-4 text-sm font-bold text-slate-500 transition hover:text-white"
              >
                Analytics
              </Link>
            )}
          </div>
        </nav>

        {/* ABOUT */}
        {(teamDescription || teamSocialLinks.length > 0) && (
          <section className="mt-7 rounded-3xl border border-[#29384a] bg-[#0a1018] p-5 md:p-6">
            {teamDescription && (
              <>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
                  About
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-300">
                  {teamDescription}
                </p>
              </>
            )}

            {teamSocialLinks.length > 0 && (
              <div
                className={
                  teamDescription
                    ? "mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-5"
                    : "flex flex-wrap gap-2"
                }
              >
                {teamSocialLinks.map((link, index) => (
                  <a
                    key={`${link.platform}-${index}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-black text-gray-300 transition hover:border-orange-500/30 hover:text-orange-300"
                  >
                    {link.platform || "Link"} ↗
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        {/* PLAYERS */}
        <TeamRosterSection
          team={team}
          slug={slug}
        />

        {/* WEEKLY RATING HISTORY */}
        {!ratingHistoryLoading &&
          teamHistory.length >= 2 && (
            <section className="mt-10 rounded-[28px] border border-white/[0.06] bg-[#101720] p-5 md:p-7">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-400">
                    Progress
                  </div>

                  <h2 className="mt-1 text-2xl font-black text-white">
                    Rating history
                  </h2>
                </div>

                <div className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-slate-500">
                  Weekly snapshots
                </div>
              </div>

              <div className="h-96">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    data={teamHistory}
                  >
                    <CartesianGrid
                      stroke="rgba(148,163,184,0.10)"
                      strokeDasharray="4 6"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="week"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "#64748b",
                        fontSize: 12,
                      }}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "#64748b",
                        fontSize: 12,
                      }}
                      domain={[
                        "dataMin - 30",
                        "dataMax + 30",
                      ]}
                    />

                    <Tooltip
                      formatter={(
                        value,
                        name,
                        item
                      ) => {
                        if (
                          name === "rating"
                        ) {
                          const rank =
                            item?.payload?.rank;

                          return [
                            rank
                              ? `${value} · World #${rank}`
                              : value,
                            "Rating",
                          ];
                        }

                        return [
                          value,
                          name,
                        ];
                      }}
                      contentStyle={{
                        background: "#090d13",
                        border:
                          "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "14px",
                        color: "#fff",
                        boxShadow:
                          "0 20px 50px rgba(0,0,0,0.35)",
                      }}
                      labelStyle={{
                        color: "#94a3b8",
                      }}
                      itemStyle={{
                        color: "#fb923c",
                        fontWeight: 800,
                      }}
                      cursor={{
                        stroke:
                          "rgba(251,146,60,0.25)",
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="rating"
                      stroke="#f97316"
                      strokeWidth={4}
                      dot={{
                        r: 3,
                        fill: "#f97316",
                        stroke: "#101720",
                        strokeWidth: 2,
                      }}
                      activeDot={{
                        r: 6,
                        fill: "#fb923c",
                        stroke: "#101720",
                        strokeWidth: 3,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
      </div>
    </div>
  );
}

export default TeamPage;