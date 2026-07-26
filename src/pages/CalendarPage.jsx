import { Link } from "react-router-dom";

import tournaments from "../data/tournaments";
import { getTournamentStatus } from "../utils/tournaments";



function formatDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

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

  if (Number.isNaN(date.getTime())) {
    return "Date TBD";
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        d="M7 3v3M17 3v3M4.5 9.5h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="12"
        cy="10"
        r="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function TeamsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 19c0-3 2.2-5 5-5s5 2 5 5M13 14c.8-.7 1.9-1 3-1 2.7 0 5 1.8 5 4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        d="m9 18 6-6-6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        d="M8 4h8v4c0 3.3-1.8 5.8-4 5.8S8 11.3 8 8V4ZM12 14v4M8.5 21h7M9.5 18h5M8 6H5.5v1.5c0 2 1.1 3.5 3 4.2M16 6h2.5v1.5c0 2-1.1 3.5-3 4.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}



function StatCard({ label, value, description, icon }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-orange-500/20 hover:bg-white/[0.05]">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-500/[0.06] blur-2xl transition group-hover:bg-orange-500/[0.1]" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </span>

          <span className="text-slate-600 transition group-hover:text-orange-400">
            {icon}
          </span>
        </div>

        <div className="mt-3 text-3xl font-black tracking-tight text-white">
          {value}
        </div>

        <div className="mt-1 text-xs text-slate-500">{description}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "live") {
    return (
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-red-300">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        Live
      </span>
    );
  }

  if (status === "finished") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-500/20 bg-slate-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        Finished
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-orange-300">
      Upcoming
    </span>
  );
}

function TournamentListRow({ tournament, status = "upcoming", featured = false }) {
  const teamsCount = Array.isArray(tournament.teams)
    ? tournament.teams.length
    : 0;

  const tierGlow = "from-orange-500/10";

  return (
    <Link
      to={`/calendar/${tournament.id}`}
      className={`group relative block overflow-hidden rounded-[22px] border transition-all duration-300 ${
        status === "live"
          ? "border-red-500/20 bg-[#11151d] shadow-[0_16px_50px_rgba(0,0,0,0.28)] hover:border-red-500/40"
          : "border-white/[0.07] bg-[#0d141e]/95 hover:-translate-y-0.5 hover:border-orange-500/25 hover:bg-[#111925]"
      } ${featured ? "p-1" : ""}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${tierGlow} via-transparent to-transparent opacity-30 transition-opacity duration-300 group-hover:opacity-55`}
      />

      <div className="pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-white/[0.025] to-transparent" />

      {status === "live" && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
      )}

      <div
        className={`relative flex items-center gap-4 ${
          featured ? "px-4 py-4 sm:px-5" : "px-4 py-4 sm:px-5"
        }`}
      >
        <div
  className={`relative flex items-center justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080d14] shadow-inner ${
    featured ? "h-16 w-16" : "h-14 w-14"
  }`}
>
  {tournament.logo ? (
    <img
      src={tournament.logo}
      alt={`${tournament.name} logo`}
      className="h-full w-full object-contain p-2.5 transition duration-300 group-hover:scale-105"
    />
  ) : (
    <TrophyIcon />
  )}
</div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />

            
          </div>

          <h3
            className={`mt-2 truncate font-black tracking-tight text-slate-100 transition group-hover:text-white ${
              featured ? "text-lg sm:text-xl" : "text-base"
            }`}
          >
            {tournament.name}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <LocationIcon />
              {tournament.location || "Location TBD"}
            </span>

            {teamsCount > 0 && (
              <span className="flex items-center gap-1.5">
                <TeamsIcon />
                {teamsCount} teams
              </span>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-5 sm:flex">
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
              Event dates
            </div>

            <div className="mt-1 text-sm font-black text-slate-300">
              {formatDateRange(tournament.startDate, tournament.endDate)}
            </div>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-500 transition duration-300 group-hover:border-orange-500/20 group-hover:bg-orange-500/10 group-hover:text-orange-300">
            <ArrowIcon />
          </div>
        </div>

        <div className="flex shrink-0 items-center sm:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-500 transition group-hover:text-orange-300">
            <ArrowIcon />
          </div>
        </div>
      </div>

      <div className="relative flex items-center justify-between border-t border-white/[0.05] px-4 py-2.5 sm:hidden">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
          Dates
        </span>

        <span className="text-xs font-bold text-slate-400">
          {formatDateRange(tournament.startDate, tournament.endDate)}
        </span>
      </div>
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  count,
  description,
  live = false,
  muted = false,
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div
          className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${
            live
              ? "text-red-400"
              : muted
                ? "text-slate-600"
                : "text-orange-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              live
                ? "animate-pulse bg-red-500"
                : muted
                  ? "bg-slate-600"
                  : "bg-orange-500"
            }`}
          />
          {eyebrow}
        </div>

        <h2
          className={`mt-2 text-2xl font-black tracking-tight ${
            muted ? "text-slate-400" : "text-white"
          }`}
        >
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>

      {count != null && (
        <div className="w-fit rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-xs font-bold text-slate-400">
          {count} {count === 1 ? "event" : "events"}
        </div>
      )}
    </div>
  );
}

function MonthSection({ month, items }) {
  return (
    <section className="relative mt-12">
      <div className="pointer-events-none absolute bottom-0 left-[19px] top-12 hidden w-px bg-gradient-to-b from-orange-500/30 via-white/[0.06] to-transparent md:block" />

      <div className="mb-5 flex items-center gap-4">
        <div className="relative z-10 hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-400 shadow-[0_0_30px_rgba(249,115,22,0.08)] md:flex">
          <CalendarIcon />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">
              Upcoming events
            </div>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
              {month}
            </h2>
          </div>

          <div className="rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-xs font-bold text-slate-500">
            {items.length} {items.length === 1 ? "event" : "events"}
          </div>
        </div>
      </div>

      <div className="space-y-3 md:ml-14">
        {items.map((item) => (
          <TournamentListRow
            key={item.tournament.id}
            tournament={item.tournament}
            status="upcoming"
          />
        ))}
      </div>
    </section>
  );
}

function EmptyCalendar() {
  return (
    <div className="relative mt-10 overflow-hidden rounded-[28px] border border-dashed border-white/[0.1] bg-[#0d141e] px-6 py-14 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.08),transparent_55%)]" />

      <div className="relative">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
          <CalendarIcon />
        </div>

        <h2 className="mt-5 text-xl font-black text-white">
          No tournaments scheduled
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          New tournaments will automatically appear here as soon as they are
          added to the calendar.
        </p>
      </div>
    </div>
  );
}

function CalendarPage() {
  const withStatus = tournaments.map((tournament) => ({
    tournament,
    status: getTournamentStatus(tournament),
  }));

  const live = withStatus
    .filter((item) => item.status === "live")
    .sort(
      (a, b) =>
        new Date(a.tournament.startDate) -
        new Date(b.tournament.startDate)
    );

  const upcoming = withStatus
    .filter((item) => item.status === "upcoming")
    .sort(
      (a, b) =>
        new Date(a.tournament.startDate) -
        new Date(b.tournament.startDate)
    );

  const finished = withStatus
    .filter((item) => item.status === "finished")
    .sort(
      (a, b) =>
        new Date(b.tournament.endDate) -
        new Date(a.tournament.endDate)
    );

  const upcomingByMonth = new Map();

  upcoming.forEach((item) => {
    const key = monthKey(item.tournament.startDate);

    if (!upcomingByMonth.has(key)) {
      upcomingByMonth.set(key, []);
    }

    upcomingByMonth.get(key).push(item);
  });

  const hasAny =
    live.length > 0 || upcoming.length > 0 || finished.length > 0;

  const nextTournament = upcoming[0]?.tournament || null;
  const totalEvents = live.length + upcoming.length + finished.length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070c12] text-white">
      {/* PAGE BACKGROUND */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(249,115,22,0.1),transparent_32%),radial-gradient(circle_at_90%_20%,rgba(14,165,233,0.06),transparent_27%)]" />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
            maskImage:
              "linear-gradient(to bottom, black, transparent 75%)",
          }}
        />

        <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-orange-500/[0.035] blur-[140px]" />
      </div>

      <main className="relative mx-auto max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0d141e]/90 shadow-[0_30px_100px_rgba(0,0,0,0.38)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-500/[0.1] via-transparent to-sky-500/[0.05]" />

          <div className="pointer-events-none absolute -left-28 -top-36 h-80 w-80 rounded-full bg-orange-500/10 blur-[100px]" />

          <div className="pointer-events-none absolute -bottom-40 -right-28 h-96 w-96 rounded-full bg-sky-500/[0.07] blur-[120px]" />

          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent" />

          <div className="relative grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1fr_360px] lg:items-center lg:px-10 lg:py-12">
            <div>
              <div className="flex w-fit items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.9)]" />
                CS2 tournament hub
              </div>

              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">
                Event
                <span className="block bg-gradient-to-r from-orange-400 via-orange-500 to-amber-300 bg-clip-text text-transparent">
                  Calendar
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                Follow live tournaments, discover upcoming events and explore
                recently completed CS2 competitions in one place.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                {live.length > 0 && (
                  <a
                    href="#live-events"
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-[0_12px_35px_rgba(249,115,22,0.22)] transition hover:-translate-y-0.5 hover:bg-orange-400"
                  >
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    Watch live events
                  </a>
                )}

                {upcoming.length > 0 && (
                  <a
                    href="#upcoming-events"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-300 transition hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-white"
                  >
                    <CalendarIcon />
                    Upcoming calendar
                  </a>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-8 rounded-full bg-orange-500/10 blur-3xl" />

              <div className="relative grid grid-cols-2 gap-3">
                <StatCard
                  label="Live now"
                  value={live.length}
                  description="Active tournaments"
                  icon={
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-50" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                    </span>
                  }
                />

                <StatCard
                  label="Upcoming"
                  value={upcoming.length}
                  description="Scheduled events"
                  icon={<CalendarIcon />}
                />

                <StatCard
                  label="Completed"
                  value={finished.length}
                  description="Finished events"
                  icon={<TrophyIcon />}
                />

                <StatCard
                  label="Total"
                  value={totalEvents}
                  description="Events tracked"
                  icon={<TeamsIcon />}
                />
              </div>

              {nextTournament && (
                <div className="mt-3 rounded-2xl border border-orange-500/15 bg-orange-500/[0.055] px-4 py-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.17em] text-orange-400">
                    Next event
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-bold text-slate-200">
                      {nextTournament.name}
                    </span>

                    <span className="shrink-0 text-xs font-black text-orange-300">
                      {formatDate(nextTournament.startDate)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {!hasAny && <EmptyCalendar />}

        {/* LIVE EVENTS */}
        {live.length > 0 && (
          <section id="live-events" className="mt-14 scroll-mt-24">
            <SectionHeading
              eyebrow="Happening now"
              title="Live tournaments"
              count={live.length}
              description="Events currently in progress."
              live
            />

            <div className="relative space-y-3 rounded-[28px] border border-red-500/10 bg-red-500/[0.025] p-3 sm:p-4">
              <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.07),transparent_45%)]" />

              {live.map((item, index) => (
                <TournamentListRow
                  key={item.tournament.id}
                  tournament={item.tournament}
                  status="live"
                  featured={index === 0}
                />
              ))}
            </div>
          </section>
        )}

        {/* UPCOMING EVENTS */}
        {upcoming.length > 0 && (
          <div id="upcoming-events" className="scroll-mt-24">
            {[...upcomingByMonth.entries()].map(([month, items]) => (
              <MonthSection key={month} month={month} items={items} />
            ))}
          </div>
        )}

        {/* FINISHED EVENTS */}
        {finished.length > 0 && (
          <section className="mt-16">
            <SectionHeading
              eyebrow="Event archive"
              title="Recently finished"
              count={finished.length}
              description="Latest completed tournaments and their results."
              muted
            />

            <div className="space-y-3">
              {finished.map((item) => (
                <div
                  key={item.tournament.id}
                  className="opacity-75 transition hover:opacity-100"
                >
                  <TournamentListRow
                    tournament={item.tournament}
                    status="finished"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default CalendarPage;