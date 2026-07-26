import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useParams } from "react-router-dom";

import tournaments from "../data/tournaments";
import teams from "../data/teams";
import { getTournamentStatus } from "../utils/tournaments";
import { formatMapName } from "../utils/formatMapName";
import { Bracket, BracketMatchBox } from "../components/TournamentBracket";
import { supabase } from "../lib/supabaseClient";

// Maps the `tournaments` Supabase row (snake_case columns) back to the same
// shape as a tournaments.generated.json entry, so the rest of this page
// doesn't need to care which one it got its data from.
function tournamentFromDbRow(row) {
  return {
    id: row.id,
    championshipId: row.championship_id,
    name: row.name,
    logo: row.logo,
    tier: row.tier,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    url: row.url,
    prizePool: row.prize_pool,
    description: row.description,
    formats: row.formats,
    teams: row.teams,
    bracket: row.bracket,
    groups: row.groups,
    prizeDistribution: row.prize_distribution,
    mapPool: row.map_pool,
    relatedEvents: row.related_events,
    matches: row.matches,
  };
}

function normalizeName(value = "") {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function findLocalTeam(name) {
  return (
    teams.find(
      (team) => normalizeName(team.name) === normalizeName(name)
    ) || null
  );
}

function formatDate(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) return "Date TBD";

  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}



function InfoPill({ label, value }) {
  if (!value) return null;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] backdrop-blur-sm transition hover:border-orange-400/20 hover:bg-white/[0.05]">
      <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className="mt-1 block text-sm font-black text-slate-100">{value}</span>
    </div>
  );
}

function Accordion({ title, subtitle, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="group overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#0d141e]/95 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-white/[0.025] sm:px-7"
      >
        <div>
          <div className="flex items-center gap-3"><span className="h-6 w-1 rounded-full bg-gradient-to-b from-orange-400 to-orange-600" /><h2 className="text-xl font-black tracking-tight text-white sm:text-[22px]">{title}</h2></div>
          {subtitle && (
            <p className="mt-1.5 pl-4 text-xs font-semibold text-slate-500">{subtitle}</p>
          )}
        </div>

        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-slate-400 transition-all duration-300 ${
            open ? "rotate-180 border-orange-400/20 text-orange-400" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && <div className="border-t border-white/[0.06]">{children}</div>}
    </section>
  );
}

function EmptyState({ children }) {
  return (
    <div className="p-6">
      <div className="rounded-2xl border border-dashed border-white/[0.09] bg-black/20 p-8 text-center text-sm font-semibold text-slate-500">
        {children}
      </div>
    </div>
  );
}

function TeamAttendingCard({ team }) {
  const localTeam = findLocalTeam(team?.name);
  const logo = team?.logo || localTeam?.logo || null;
  const slug = team?.slug || localTeam?.slug || null;
  const isTbd = !team?.name;

  const content = (
    <div className="group/card relative flex min-h-[184px] flex-col items-center gap-3 overflow-hidden rounded-[22px] border border-white/[0.065] bg-gradient-to-b from-white/[0.04] to-black/10 p-4 text-center shadow-[0_12px_30px_rgba(0,0,0,0.14)] transition duration-300 hover:-translate-y-1 hover:border-orange-400/25 hover:shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div className="flex w-full items-center justify-between text-[10px] font-black">
        {team?.rank ? (
          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-400">
            #{team.rank}
          </span>
        ) : (
          <span />
        )}

        {team?.seed && (
          <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-orange-400">
            #{team.seed}
          </span>
        )}
      </div>

      {isTbd ? (
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-[#2a3546] text-lg font-black text-slate-600">
          ?
        </div>
      ) : logo ? (
        <img
          src={logo}
          alt=""
          className="h-16 w-16 rounded-2xl border border-white/[0.06] bg-black/25 object-contain p-2 shadow-lg transition duration-300 group-hover/card:scale-105"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#243041] bg-[#0b0f14] text-lg font-black text-slate-600">
          ?
        </div>
      )}

      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-200">
          {team?.name || "TBD"}
        </div>

        {isTbd && team?.qualifierName ? (
          team.qualifierId ? (
            <Link
              to={`/calendar/${team.qualifierId}`}
              className="text-xs text-orange-400 hover:text-orange-300"
            >
              {team.qualifierName}
            </Link>
          ) : (
            <div className="text-xs text-slate-600">
              {team.qualifierName}
            </div>
          )
        ) : (
          team?.region && (
            <div className="text-xs text-slate-600">{team.region}</div>
          )
        )}
      </div>
    </div>
  );

  if (slug) {
    return <Link to={`/teams/${slug}`}>{content}</Link>;
  }

  return content;
}

function PrizeDistributionCard({ entry }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border border-white/[0.065] bg-gradient-to-b from-white/[0.045] to-black/10 p-5 text-center shadow-[0_12px_30px_rgba(0,0,0,0.14)] transition duration-300 hover:-translate-y-1 hover:border-orange-400/20 ${
        entry.wide ? "sm:col-span-2" : ""
      }`}
    >
      <div className="text-sm font-black text-slate-200">{entry.place}</div>
      <div className="mt-1 text-lg font-black text-orange-400">
        {entry.amount}
      </div>

      {entry.team?.name && (
        <div className="mt-2 flex items-center justify-center gap-2">
          {entry.team.logo && (
            <img
              src={entry.team.logo}
              alt=""
              className="h-5 w-5 rounded-sm object-contain"
            />
          )}
          <span className="truncate text-xs font-bold text-slate-300">
            {entry.team.name}
          </span>
        </div>
      )}
    </div>
  );
}

function MapPoolGrid({ maps }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 sm:gap-4 sm:p-7 lg:grid-cols-4 xl:grid-cols-5">
      {maps.map((map) => {
        const name = formatMapName(map);
        const slug = String(map || "")
          .trim()
          .toLowerCase()
          .replace(/^de_/i, "");

        return (
          <div
            key={map}
            className="group/map relative flex h-28 items-end overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#0b1119] shadow-[0_12px_28px_rgba(0,0,0,0.2)] transition duration-300 hover:-translate-y-1 hover:border-orange-400/30"
          >
            <img
              src={`/maps/${slug}.png`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-500 group-hover/map:scale-110 group-hover/map:opacity-75"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
            <div className="relative w-full px-4 py-3 text-sm font-black tracking-wide text-white">
              {name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RelatedEventsList({ events }) {
  return (
    <div className="divide-y divide-white/[0.06]">
      {events.map((event, index) => {
        const content = (
          <div className="flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-300 transition hover:bg-white/[0.025] hover:text-orange-400 sm:px-7">
            {event.name}
          </div>
        );

        if (event.id) {
          return (
            <Link key={index} to={`/calendar/${event.id}`}>
              {content}
            </Link>
          );
        }

        if (event.url) {
          return (
            <a
              key={index}
              href={event.url}
              target="_blank"
              rel="noreferrer"
            >
              {content}
            </a>
          );
        }

        return <div key={index}>{content}</div>;
      })}
    </div>
  );
}

function MatchScheduleRow({ match }) {
  const team1 = match?.team1 || {};
  const team2 = match?.team2 || {};
  const played = match?.score1 != null && match?.score2 != null;
  const team1Won = played && match.score1 > match.score2;
  const team2Won = played && match.score2 > match.score1;

  const content = (
    <div className="group/match grid grid-cols-[minmax(0,1fr)_74px_minmax(0,1fr)] items-center gap-3 rounded-[20px] border border-white/[0.065] bg-gradient-to-r from-white/[0.035] via-white/[0.02] to-white/[0.035] px-4 py-4 shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-0.5 hover:border-orange-400/25 hover:bg-white/[0.045] sm:px-5">
      <div className="flex items-center justify-end gap-2 text-right">
        <span
          className={`truncate text-sm font-bold ${
            team1Won ? "text-emerald-400" : "text-slate-300"
          }`}
        >
          {team1.name || "TBD"}
        </span>
        {team1.logo && (
          <img
            src={team1.logo}
            alt=""
            className="h-8 w-8 shrink-0 rounded-lg border border-white/[0.05] bg-black/20 object-contain p-1"
          />
        )}
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-black/25 px-2 py-2 text-center text-sm font-black text-white shadow-inner">
        {played ? `${match.score1} : ${match.score2}` : "vs"}
      </div>

      <div className="flex items-center gap-2">
        {team2.logo && (
          <img
            src={team2.logo}
            alt=""
            className="h-8 w-8 shrink-0 rounded-lg border border-white/[0.05] bg-black/20 object-contain p-1"
          />
        )}
        <span
          className={`truncate text-sm font-bold ${
            team2Won ? "text-emerald-400" : "text-slate-300"
          }`}
        >
          {team2.name || "TBD"}
        </span>
      </div>
    </div>
  );

  if (match?.id) {
    return <Link to={`/match/${match.id}`}>{content}</Link>;
  }

  return content;
}

function MatchesSchedule({ matches }) {
  const groups = new Map();

  matches.forEach((match) => {
    const key = match.date ? formatDate(match.date) : "Date TBD";

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(match);
  });

  return (
    <div className="space-y-7 p-5 sm:p-7">
      {[...groups.entries()].map(([date, items]) => (
        <div key={date}>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 before:h-px before:w-7 before:bg-orange-500/50">
            {date}
          </div>
          <div className="space-y-2">
            {items.map((match) => (
              <MatchScheduleRow key={match.id} match={match} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupSection({ group }) {
  const hasLower = Array.isArray(group.lower) && group.lower.length > 0;

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 before:h-px before:w-7 before:bg-orange-500/50">
        Upper Bracket
      </div>
      <Bracket rounds={group.upper} />

      {hasLower && (
        <>
          <div className="mb-2 mt-6 text-xs font-black uppercase tracking-wide text-slate-500">
            Lower Bracket
          </div>
          <Bracket rounds={group.lower} />
        </>
      )}

      {group.final && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 before:h-px before:w-7 before:bg-orange-500/50">
            Group Final
          </div>
          <div className="max-w-[220px]">
            <BracketMatchBox match={group.final} />
          </div>
        </div>
      )}
    </div>
  );
}

function TournamentPage() {
  const { id } = useParams();

  const staticTournament = tournaments.find((item) => item.id === id) || null;

  const [liveTournament, setLiveTournament] = useState(null);
  const [loadingLive, setLoadingLive] = useState(Boolean(supabase));

  const loadLiveTournament = useCallback(async () => {
    if (!supabase || !id) {
      setLoadingLive(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLiveTournament(tournamentFromDbRow(data));
      }
    } catch (error) {
      console.error("Failed to load live tournament data:", error);
    } finally {
      setLoadingLive(false);
    }
  }, [id]);

  useEffect(() => {
    setLoadingLive(Boolean(supabase));
    setLiveTournament(null);
    loadLiveTournament();
  }, [loadLiveTournament]);

  // Supabase is refreshed on a schedule (scripts/tournamentWorker.js,
  // running on Railway) and wins wholesale over the bundled snapshot
  // whenever a row exists — same "live data overrides static" idea as
  // LiveMatchPage.jsx.
  const tournament = liveTournament || staticTournament;

  const status = getTournamentStatus(tournament || {});
  const isLive = status === "live";

  useEffect(() => {
    if (!isLive) {
      return undefined;
    }

    const intervalId = window.setInterval(loadLiveTournament, 30000);
    return () => window.clearInterval(intervalId);
  }, [isLive, loadLiveTournament]);

  // The bracket/schedule structure only changes as often as
  // tournamentWorker.js ticks (a few minutes) — a brand new round doesn't
  // exist on FACEIT until the previous one finishes, so that lag is
  // unavoidable. But individual match scores update every ~7s via
  // scripts/worker.js, so this overlays live scores from `matches` on top
  // of whatever the bracket/schedule snapshot has, independently and more
  // often, instead of waiting on the next structural refresh.
  const matchIds = useMemo(() => {
    const ids = new Set();
    const rounds = tournament?.bracket?.rounds;

    if (Array.isArray(rounds)) {
      rounds.forEach((round) => {
        (round.matches || []).forEach((match) => {
          if (match.matchId) ids.add(match.matchId);
        });
      });
    }

    const flat = tournament?.matches;

    if (Array.isArray(flat)) {
      flat.forEach((match) => {
        if (match.id) ids.add(match.id);
      });
    }

    return [...ids];
  }, [tournament]);

  const [liveMatchScores, setLiveMatchScores] = useState({});

  const loadLiveMatchScores = useCallback(async () => {
    if (!supabase || matchIds.length === 0) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from("matches")
        .select("id,status,team1_id,team1_score,team2_id,team2_score,winner_id")
        .in("id", matchIds);

      if (error) throw error;

      const byId = {};
      (data || []).forEach((row) => {
        byId[row.id] = row;
      });
      setLiveMatchScores(byId);
    } catch (error) {
      console.error("Failed to load live match scores:", error);
    }
  }, [matchIds]);

  useEffect(() => {
    loadLiveMatchScores();
  }, [loadLiveMatchScores]);

  useEffect(() => {
    if (!isLive) {
      return undefined;
    }

    const intervalId = window.setInterval(loadLiveMatchScores, 15000);
    return () => window.clearInterval(intervalId);
  }, [isLive, loadLiveMatchScores]);

  if (loadingLive && !staticTournament) {
    return (
      <div className="min-h-screen bg-[#090f16] p-8 text-center text-white">
        Loading tournament...
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-[#090f16] p-8 text-center text-white">
        <div className="text-xl font-bold">Tournament not found</div>
        <Link
          to="/calendar"
          className="mt-4 inline-block text-orange-400 hover:text-orange-300"
        >
          ← Back to Calendar
        </Link>
      </div>
    );
  }

  const teamsList = Array.isArray(tournament.teams) ? tournament.teams : [];
  const groups = Array.isArray(tournament.groups) ? tournament.groups : [];
  const prizeDistribution = Array.isArray(tournament.prizeDistribution)
    ? tournament.prizeDistribution
    : [];
  const mapPool = Array.isArray(tournament.mapPool)
    ? tournament.mapPool
    : [];
  const relatedEvents = Array.isArray(tournament.relatedEvents)
    ? tournament.relatedEvents
    : [];

  const bracketRounds = (
    Array.isArray(tournament.bracket?.rounds) ? tournament.bracket.rounds : []
  ).map((round) => ({
    ...round,
    matches: (round.matches || []).map((match) => {
      const live = match.matchId ? liveMatchScores[match.matchId] : null;
      if (!live) return match;

      return {
        ...match,
        score1: live.team1_score ?? match.score1,
        score2: live.team2_score ?? match.score2,
        winner:
          live.winner_id && live.winner_id === live.team1_id
            ? 1
            : live.winner_id && live.winner_id === live.team2_id
              ? 2
              : match.winner,
      };
    }),
  }));

  const scheduleMatches = (
    Array.isArray(tournament.matches) ? tournament.matches : []
  ).map((match) => {
    const live = match.id ? liveMatchScores[match.id] : null;
    if (!live) return match;

    return {
      ...match,
      score1: live.team1_score ?? match.score1,
      score2: live.team2_score ?? match.score2,
    };
  });
  const hasFormats = Boolean(
    tournament.formats?.groupStage?.length ||
      tournament.formats?.playoffs?.length
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070c12] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12rem] top-20 h-[34rem] w-[34rem] rounded-full bg-orange-500/[0.055] blur-[110px]" />
        <div className="absolute right-[-14rem] top-[28rem] h-[38rem] w-[38rem] rounded-full bg-sky-500/[0.045] blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:42px_42px]" />
      </div>
      <div className="relative z-10 mx-auto max-w-[1320px]">
        <Link
          to="/calendar"
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-sm font-bold text-orange-400 transition hover:border-orange-400/20 hover:bg-orange-500/[0.06] hover:text-orange-300"
        >
          ← Back to Calendar
        </Link>

        {/* HERO */}
        <section className="relative mt-5 overflow-hidden rounded-[34px] border border-white/[0.08] bg-gradient-to-br from-[#121b27] via-[#0d141e] to-[#0a1018] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)] md:p-10 lg:p-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/80 to-transparent" />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="absolute -left-28 -top-32 h-96 w-96 rounded-full bg-orange-500/15 blur-3xl" />
            <div className="absolute -right-28 -bottom-36 h-96 w-96 rounded-full bg-sky-500/12 blur-3xl" />
          </div>

          <div className="relative flex flex-col items-center gap-8 md:flex-row md:items-center lg:gap-12">
            {tournament.logo && (
  <img
    src={tournament.logo}
    alt=""
    className="h-32 w-32 shrink-0 rounded-[28px] border border-white/[0.08] bg-black/25 object-contain p-4 shadow-[0_22px_55px_rgba(0,0,0,0.35)] md:h-40 md:w-40"
  />
)}

            <div className="min-w-0 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                

                {isLive ? (
                  <span className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    Live
                  </span>
                ) : (
                  <span className="rounded-lg border border-white/[0.07] bg-white/[0.035] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {status || "upcoming"}
                  </span>
                )}
              </div>

              <h1 className="mt-4 max-w-4xl text-3xl font-black leading-[1.02] tracking-[-0.035em] text-white sm:text-4xl md:text-6xl">
                {tournament.name}
              </h1>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <InfoPill label="Location" value={tournament.location} />
                <InfoPill
                  label="Dates"
                  value={formatDateRange(
                    tournament.startDate,
                    tournament.endDate
                  )}
                />
                <InfoPill label="Teams" value={teamsList.length || null} />
                <InfoPill label="Prize pool" value={tournament.prizePool} />
              </div>

              {tournament.url && (
                <a
                  href={tournament.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-7 inline-flex items-center rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(249,115,22,0.25)] transition hover:-translate-y-0.5 hover:from-orange-400 hover:to-orange-500"
                >
                  View source →
                </a>
              )}
            </div>
          </div>
        </section>

        {/* OVERVIEW */}
        {tournament.description && (
          <div className="mt-6">
            <Accordion title="Overview">
              <div className="p-5 sm:p-6">
                <p className="max-w-4xl text-[15px] leading-8 text-slate-300">
                  {tournament.description}
                </p>
              </div>
            </Accordion>
          </div>
        )}

        {/* PLAYOFFS */}
        {bracketRounds.length > 0 && (
          <div className="mt-6">
            <Accordion title="Playoffs">
              <div className="p-5 sm:p-6">
                <Bracket rounds={bracketRounds} />
              </div>
            </Accordion>
          </div>
        )}

        {/* MATCHES */}
        {scheduleMatches.length > 0 && (
          <div className="mt-6">
            <Accordion
              title="Matches"
              subtitle={`${scheduleMatches.length} matches`}
            >
              <MatchesSchedule matches={scheduleMatches} />
            </Accordion>
          </div>
        )}

        {/* GROUP STAGE */}
        {groups.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="px-1 text-lg font-black text-slate-400">
              Group Stage
            </h2>

            {groups.map((group) => (
              <Accordion key={group.name} title={group.name}>
                <GroupSection group={group} />
              </Accordion>
            ))}
          </div>
        )}

        {/* TEAMS */}
        <div className="mt-6">
          <Accordion
            title="Teams attending"
            subtitle={
              teamsList.length > 0 ? `${teamsList.length} teams` : undefined
            }
          >
            {teamsList.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 sm:gap-4 sm:p-7 lg:grid-cols-4 xl:grid-cols-5">
                {teamsList.map((team, index) => (
                  <TeamAttendingCard
                    key={`${team.name}-${index}`}
                    team={team}
                  />
                ))}
              </div>
            ) : (
              <EmptyState>
                Teams will be announced closer to the event.
              </EmptyState>
            )}
          </Accordion>
        </div>

        {/* PRIZE DISTRIBUTION */}
        {prizeDistribution.length > 0 && (
          <div className="mt-6">
            <Accordion title="Prize distribution">
              <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 sm:gap-4 sm:p-7">
                {prizeDistribution.map((entry, index) => (
                  <PrizeDistributionCard key={index} entry={entry} />
                ))}
              </div>
            </Accordion>
          </div>
        )}

        {/* FORMATS */}
        {hasFormats && (
          <div className="mt-6">
            <Accordion title="Formats">
              <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-7">
                {tournament.formats.groupStage?.length > 0 && (
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Group stage
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-slate-300">
                      {tournament.formats.groupStage.map((line, index) => (
                        <div key={index}>{line}</div>
                      ))}
                    </div>
                  </div>
                )}

                {tournament.formats.playoffs?.length > 0 && (
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Playoffs
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-slate-300">
                      {tournament.formats.playoffs.map((line, index) => (
                        <div key={index}>{line}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Accordion>
          </div>
        )}

        {/* MAP POOL */}
        {mapPool.length > 0 && (
          <div className="mt-6">
            <Accordion title="Map pool">
              <MapPoolGrid maps={mapPool} />
            </Accordion>
          </div>
        )}

        {/* RELATED EVENTS */}
        {relatedEvents.length > 0 && (
          <div className="mt-6">
            <Accordion title="Related events">
              <RelatedEventsList events={relatedEvents} />
            </Accordion>
          </div>
        )}
      </div>
    </div>
  );
}

export default TournamentPage;