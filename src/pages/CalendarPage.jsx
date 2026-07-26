import { Link } from "react-router-dom";

import tournaments from "../data/tournaments";
import { getTournamentStatus } from "../utils/tournaments";

const TIER_STYLES = {
  S: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  A: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  B: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
};

function formatDate(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatDateRange(startDate, endDate) {
  if (!startDate) return "Date TBD";
  if (!endDate || endDate === startDate) return formatDate(startDate);

  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function monthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBD";

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function TierBadge({ tier }) {
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${
        TIER_STYLES[tier] || "border-slate-600/30 bg-slate-500/10 text-slate-400"
      }`}
    >
      {tier || "?"}
    </div>
  );
}

function TournamentListRow({ tournament, isLive }) {
  const teamsCount = Array.isArray(tournament.teams) ? tournament.teams.length : 0;

  return (
    <Link
      to={`/calendar/${tournament.id}`}
      className="flex items-center gap-4 rounded-2xl border border-[#1d2634] bg-[#0b1119] px-5 py-4 transition hover:border-orange-500/30 hover:bg-white/[0.02]"
    >
      {tournament.logo ? (
        <img
          src={tournament.logo}
          alt=""
          className="h-11 w-11 shrink-0 rounded-xl bg-[#0b0f14] object-contain p-1.5"
        />
      ) : (
        <TierBadge tier={tournament.tier} />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-slate-100">{tournament.name}</span>
          {isLive && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              Live
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">
          {tournament.location || "Location TBD"}
          {teamsCount > 0 && ` · ${teamsCount} teams`}
        </div>
      </div>

      <div className="shrink-0 text-right text-xs font-bold text-slate-400">
        {formatDateRange(tournament.startDate, tournament.endDate)}
      </div>
    </Link>
  );
}

function CalendarPage() {
  const withStatus = tournaments.map((tournament) => ({
    tournament,
    status: getTournamentStatus(tournament),
  }));

  const live = withStatus.filter((item) => item.status === "live");

  const upcoming = withStatus
    .filter((item) => item.status === "upcoming")
    .sort(
      (a, b) => new Date(a.tournament.startDate) - new Date(b.tournament.startDate)
    );

  const finished = withStatus
    .filter((item) => item.status === "finished")
    .sort(
      (a, b) => new Date(b.tournament.endDate) - new Date(a.tournament.endDate)
    );

  // New tournaments just slot into their month's group automatically —
  // nothing here is manually ordered, it's all driven by startDate.
  const upcomingByMonth = new Map();
  upcoming.forEach((item) => {
    const key = monthKey(item.tournament.startDate);
    if (!upcomingByMonth.has(key)) upcomingByMonth.set(key, []);
    upcomingByMonth.get(key).push(item);
  });

  const hasAny = live.length > 0 || upcoming.length > 0 || finished.length > 0;

  return (
    <div className="min-h-screen bg-[#090f16] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,140,0,0.06),transparent_60%)]" />

      <div className="relative mx-auto max-w-4xl px-4 py-12 md:px-8">
        <h1 className="text-4xl font-bold leading-tight md:text-5xl">
          Event <span className="text-orange-500">Calendar</span>
        </h1>

        <p className="mt-4 max-w-3xl leading-7 text-gray-400">
          Upcoming and live CS2 tournaments, sorted by date.
        </p>

        {!hasAny && (
          <div className="mt-10 rounded-2xl border border-dashed border-[#2a3546] bg-[#0b1119] p-8 text-center text-sm text-slate-500">
            No tournaments scheduled yet.
          </div>
        )}

        {live.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-3 text-lg font-black text-slate-300">Live now</h2>
            <div className="space-y-2">
              {live.map((item) => (
                <TournamentListRow
                  key={item.tournament.id}
                  tournament={item.tournament}
                  isLive
                />
              ))}
            </div>
          </div>
        )}

        {[...upcomingByMonth.entries()].map(([month, items]) => (
          <div key={month} className="mt-10">
            <h2 className="mb-3 text-lg font-black text-slate-300">{month}</h2>
            <div className="space-y-2">
              {items.map((item) => (
                <TournamentListRow key={item.tournament.id} tournament={item.tournament} />
              ))}
            </div>
          </div>
        ))}

        {finished.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-3 text-lg font-black text-slate-500">Recently finished</h2>
            <div className="space-y-2 opacity-70">
              {finished.map((item) => (
                <TournamentListRow key={item.tournament.id} tournament={item.tournament} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendarPage;
