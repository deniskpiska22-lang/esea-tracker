import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import teams from "../data/teams";
import matchesData from "../data/matches";
import {
  buildOpponentBanOrderStats,
  buildTeamBanOrderStats,
  buildVetoStats,
  useTeamStats,
} from "../hooks/useTeamStats";
import { formatMapName } from "../utils/formatMapName";
import TournamentNameLink from "../components/TournamentNameLink";

// This tab is scoped to recent form rather than full team history — veto
// tendencies (map pool, ban priorities) shift with roster/meta changes,
// so a 90-day rolling window stays representative of how a team plays
// right now instead of averaging in patterns from a year ago.
const VETO_WINDOW_DAYS = 90;

function isWithinVetoWindow(match) {
  if (!match?.date) return false;
  const matchTime = new Date(match.date).getTime();
  if (Number.isNaN(matchTime)) return false;

  const cutoff = Date.now() - VETO_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return matchTime >= cutoff;
}

// Overpass is out of the active map pool — kept out of every veto
// aggregation (flow, opponent tendencies, map pool cards) below so it
// doesn't skew percentages for a map nobody can actually play anymore.
// Match History is left untouched since it's a factual log of what
// actually happened in each past match, not a forward-looking stat.
const EXCLUDED_MAPS = ["overpass"];

function stripExcludedMapSteps(matches) {
  return matches.map((match) => {
    const vetoSteps = Array.isArray(match.vetoSteps)
      ? match.vetoSteps.filter(
          (step) => !EXCLUDED_MAPS.includes(String(step.map).toLowerCase())
        )
      : match.vetoSteps;

    return { ...match, vetoSteps };
  });
}

// Page-local presentational helper (not part of useTeamStats) — recent
// W/L form and a simple trend per map, derived purely from the mapScores
// each match object already carries. Not tied to veto data at all, so a
// map's form still shows even on matches veto backfill hasn't reached.
function buildMapFormByName(matches) {
  const chronological = [...matches].sort(
    (first, second) =>
      new Date(first.date || 0).getTime() -
      new Date(second.date || 0).getTime()
  );

  const resultsByMap = {};

  chronological.forEach((match) => {
    (Array.isArray(match.mapScores) ? match.mapScores : []).forEach(
      (mapScore) => {
        const key = String(mapScore.map || "").toLowerCase();
        if (!key) return;

        if (!resultsByMap[key]) {
          resultsByMap[key] = [];
        }

        resultsByMap[key].push(Boolean(mapScore.won));
      }
    );
  });

  const form = {};

  Object.entries(resultsByMap).forEach(([key, results]) => {
    const recent = results.slice(-5);
    const recentWinrate =
      recent.length > 0
        ? recent.filter(Boolean).length / recent.length
        : 0;
    const overallWinrate = results.filter(Boolean).length / results.length;

    let trend = "flat";
    if (recent.length >= 2) {
      if (recentWinrate - overallWinrate >= 0.15) trend = "up";
      else if (overallWinrate - recentWinrate >= 0.15) trend = "down";
    }

    form[key] = { recent, trend };
  });

  return form;
}

// Reshapes a { orders, rows } ban-order-by-map structure (from
// buildTeamBanOrderStats/buildOpponentBanOrderStats) into groups keyed by
// ban position instead — "1st ban: Mirage 82%, Dust2 11%..." — which is
// the order the VETO FLOW / opponent tendencies sections read in.
function groupBanOrderByPosition({ orders, rows }) {
  return orders
    .map((order) => {
      const index = order - 1;
      const entries = rows
        .map((row) => ({ name: row.name, ...row.byOrder[index] }))
        .filter((entry) => entry.count > 0)
        .sort((first, second) => second.percent - first.percent);

      return { order, entries };
    })
    .filter((group) => group.entries.length > 0);
}

function getMapRatingTier(winrate, hasDecisions) {
  if (!hasDecisions) return null;
  if (winrate >= 70) return "S";
  if (winrate >= 55) return "A";
  if (winrate >= 45) return "B";
  if (winrate >= 30) return "C";
  return "D";
}

const TIER_STYLES = {
  S: "border-emerald-400/60 bg-emerald-500/15 text-emerald-300",
  A: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  B: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  C: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  D: "border-rose-500/40 bg-rose-500/10 text-rose-400",
};

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

function ordinalLabel(order) {
  const suffixes = ["th", "st", "nd", "rd"];
  const remainder = order % 100;

  const suffix =
    suffixes[(remainder - 20) % 10] ||
    suffixes[remainder] ||
    suffixes[0];

  return `${order}${suffix}`;
}

const CARD_HOVER =
  "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#ff8c32]/50 hover:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.6)]";

function MapThumb({ name, size = "h-7 w-11" }) {
  const imageName = normalizeMapImageName(name);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-md border border-white/5 ${size}`}
    >
      <img
        src={`/maps/${imageName}.png`}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
    </div>
  );
}

function SectionEyebrow({ children }) {
  return (
    <div className="text-[13px] font-black uppercase tracking-[0.16em] text-[#ff8c32]">
      {children}
    </div>
  );
}

function HeroStatCard({ label, value, valueClass }) {
  return (
    <div className="min-w-[108px] rounded-lg border border-white/5 bg-[#151e29] px-3 py-2">
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#587094]">
        {label}
      </div>
      <div
        className={`mt-0.5 truncate text-base font-black ${
          valueClass || "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// Shared visual for both VETO FLOW (this team's own bans) and OPPONENT
// TENDENCIES (opponents' bans against this team) — grouped by ban
// position, largest bar on top, exactly how a coach reads a veto sheet.
function BanOrderFlow({
  eyebrow,
  title,
  description,
  banOrderStats,
  barClass,
  loading,
  emptyMessage,
}) {
  const groups = groupBanOrderByPosition(banOrderStats);

  return (
    <section className="rounded-xl border border-white/5 bg-[#111923] p-4 sm:p-6">
      <SectionEyebrow>{eyebrow}</SectionEyebrow>
      <h2 className="mt-1 text-lg font-black sm:text-xl">{title}</h2>
      {description && (
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#6e87ad]">
          {description}
        </p>
      )}

      {groups.length > 0 ? (
        <div className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <div key={group.order}>
              <div className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#8ca2c2]">
                {ordinalLabel(group.order)} Ban
              </div>
              <div className="space-y-3">
                {group.entries.map((entry) => (
                  <div key={entry.name}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <MapThumb name={entry.name} size="h-6 w-9" />
                        <span className="truncate text-xs font-bold text-slate-200">
                          {formatMapName(entry.name)}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-black text-white">
                        {entry.percent}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#0b1117]">
                      <div
                        className={`h-full rounded-full ${barClass}`}
                        style={{ width: `${entry.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <div className="py-10 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        )
      )}
    </section>
  );
}

const ACTION_CHIP_STYLES = {
  Picked: "border-emerald-500/35 bg-emerald-500/10 text-emerald-400",
  Banned: "border-rose-500/35 bg-rose-500/10 text-rose-400",
  Decider: "border-amber-500/35 bg-amber-500/10 text-amber-400",
};

function VetoStepChip({ step }) {
  const sideLabel =
    step.side === "team" ? "Us" : step.side === "opponent" ? "Opp" : "";

  return (
    <span
      title={`${step.action}${sideLabel ? ` · ${sideLabel}` : ""}`}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
        ACTION_CHIP_STYLES[step.action] ||
        "border-white/10 bg-[#0b1119] text-slate-400"
      }`}
    >
      {formatMapName(step.map)}
      {sideLabel && <span className="opacity-70">({sideLabel})</span>}
    </span>
  );
}

function OpponentAvatar({ name }) {
  const initial =
    String(name || "?")
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0b1119] text-xs font-black text-[#8ca2c2]">
      {initial}
    </div>
  );
}

function MatchHistoryCard({ match }) {
  const id = match.matchId || match.id;
  const steps = Array.isArray(match.vetoSteps) ? match.vetoSteps : [];
  const visibleSteps = steps.slice(0, 3);
  const extraSteps = steps.length - visibleSteps.length;

  return (
    <Link
      to={`/match/${id}`}
      className={`flex h-[70px] items-center gap-3 rounded-xl border border-white/5 bg-[#111923] px-3.5 sm:px-4 ${CARD_HOVER}`}
    >
      <OpponentAvatar name={match.opponentName} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black text-slate-100">
          vs {match.opponentName || "Unknown"}
        </div>
        <div className="mt-0.5 truncate text-[11px] font-semibold text-[#587094]">
          {formatDate(match.date)}
          {match.season && (
            <>
              {" · "}
              <TournamentNameLink name={match.season} />
            </>
          )}
        </div>
      </div>

      {visibleSteps.length > 0 && (
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          {visibleSteps.map((step, index) => (
            <VetoStepChip key={`${step.map}-${index}`} step={step} />
          ))}
          {extraSteps > 0 && (
            <span className="rounded-md border border-white/10 bg-[#0b1119] px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
              +{extraSteps}
            </span>
          )}
        </div>
      )}

      <div className="shrink-0 text-right">
        <div className="text-base font-black text-white">
          {match.boScore ||
            `${match.teamScore ?? 0} : ${match.opponentScore ?? 0}`}
        </div>
      </div>

      <div
        className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-black uppercase ${
          match.won
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-rose-500/10 text-rose-400"
        }`}
      >
        {match.won ? "W" : "L"}
      </div>
    </Link>
  );
}

function MapCard({ map, form, slug }) {
  const imageName = normalizeMapImageName(map.name);
  const hasDecisions = map.winsWhenPicked + map.lossesWhenPicked > 0;
  const tier = getMapRatingTier(map.winrateWhenPicked, hasDecisions);
  const recentResults = form?.recent || [];
  const hasTrend = Boolean(form) && recentResults.length >= 2;
  const trend = form?.trend || "flat";
  const trendGlyph = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendClass =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
        ? "text-rose-400"
        : "text-slate-500";

  return (
    <Link
      to={`/team/${slug}/matches?map=${encodeURIComponent(map.name)}`}
      className={`group relative block overflow-hidden rounded-xl border border-white/5 bg-[#111923] ${CARD_HOVER}`}
    >
      <div className="relative h-16 w-full overflow-hidden sm:h-20">
        <img
          src={`/maps/${imageName}.png`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1119] via-[#0b1119]/35 to-transparent" />

        {tier && (
          <div
            className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border text-[10px] font-black ${TIER_STYLES[tier]}`}
            title={`Map rating: ${tier} tier`}
          >
            {tier}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
          <div className="truncate text-sm font-black text-white drop-shadow">
            {formatMapName(map.name)}
          </div>

          {recentResults.length > 0 && (
            <div className="flex shrink-0 items-center gap-0.5">
              {recentResults.map((won, index) => (
                <span
                  key={index}
                  className={`h-1.5 w-1.5 rounded-full ${
                    won ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                  title={won ? "Win" : "Loss"}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-2.5 sm:p-3">
        <div className="flex items-center justify-between">
          <div
            className={`text-xl font-black ${
              hasDecisions
                ? getWinrateTextClass(map.winrateWhenPicked)
                : "text-slate-500"
            }`}
          >
            {hasDecisions ? `${map.winrateWhenPicked}%` : "—"}
          </div>

          {hasTrend && (
            <span
              className={`text-base font-black ${trendClass}`}
              title={`Recent form vs. overall — ${trend}`}
            >
              {trendGlyph}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-3 text-[10px] font-bold">
          <span className="text-emerald-400">{map.pickRate}% pick</span>
          <span className="text-rose-400">{map.banRate}% ban</span>
        </div>
      </div>
    </Link>
  );
}

function VetoPage() {
  const { slug } = useParams();

  const team = teams.find((item) => item.slug === slug) || null;
  const fallbackMatches = matchesData.filter(
    (match) => match.teamSlug === slug
  );

  const {
    matches: teamMatches,
    loading,
    error,
  } = useTeamStats(slug, fallbackMatches);

  // Everything on this tab is scoped to the last VETO_WINDOW_DAYS days —
  // see the constant above for why. teamMatches itself (full history)
  // still powers Overview/Statistics via useTeamStats elsewhere.
  const recentMatches = useMemo(
    () => teamMatches.filter(isWithinVetoWindow),
    [teamMatches]
  );

  // Same 90-day matches, but with Overpass steps stripped out before any
  // veto aggregation — see EXCLUDED_MAPS above.
  const vetoEligibleMatches = useMemo(
    () => stripExcludedMapSteps(recentMatches),
    [recentMatches]
  );

  const vetoStats = useMemo(
    () => buildVetoStats(vetoEligibleMatches),
    [vetoEligibleMatches]
  );

  const ourBanOrder = useMemo(
    () => buildTeamBanOrderStats(vetoEligibleMatches),
    [vetoEligibleMatches]
  );

  const opponentBanOrder = useMemo(
    () => buildOpponentBanOrderStats(vetoEligibleMatches),
    [vetoEligibleMatches]
  );

  const mapFormByName = useMemo(
    () => buildMapFormByName(recentMatches),
    [recentMatches]
  );

  const matchesWithVeto = recentMatches.filter(
    (match) => Array.isArray(match.vetoSteps) && match.vetoSteps.length > 0
  );

  const sortedVetoMatches = [...matchesWithVeto].sort(
    (first, second) =>
      new Date(second.date || 0).getTime() -
      new Date(first.date || 0).getTime()
  );

  const mostPickedByUs =
    [...vetoStats].sort((first, second) => second.pickRate - first.pickRate)[0] ||
    null;

  const mostBannedByUs =
    [...vetoStats].sort((first, second) => second.banRate - first.banRate)[0] ||
    null;

  const bestMapForUs =
    [...vetoStats]
      .filter((map) => map.winsWhenPicked + map.lossesWhenPicked > 0)
      .sort(
        (first, second) => second.winrateWhenPicked - first.winrateWhenPicked
      )[0] || null;

  if (!team) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1117] p-8 text-white">
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
    <main className="min-h-screen bg-[#0b1117] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <Link
          to={`/team/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-orange-400 transition hover:text-orange-300"
        >
          ← Back to Team
        </Link>

        {/* HERO */}
        <section className="mt-3 rounded-xl border border-white/5 bg-[#111923] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {team.logo && (
                <img
                  src={team.logo}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg border border-white/10 object-cover"
                />
              )}
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ff8c32]">
                  {team.name}
                </div>
                <h1 className="mt-0.5 text-[26px] font-black uppercase leading-none tracking-tight">
                  Veto Analytics
                </h1>
                <div className="mt-1 text-[11px] font-semibold text-[#587094]">
                  Last {VETO_WINDOW_DAYS} days
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <HeroStatCard
                label="Matches"
                value={recentMatches.length}
              />
              <HeroStatCard
                label="Favorite Pick"
                value={
                  mostPickedByUs ? formatMapName(mostPickedByUs.name) : "—"
                }
                valueClass="text-emerald-400"
              />
              <HeroStatCard
                label="Favorite Ban"
                value={
                  mostBannedByUs ? formatMapName(mostBannedByUs.name) : "—"
                }
                valueClass="text-rose-400"
              />
              <HeroStatCard
                label="Best Map"
                value={
                  bestMapForUs ? formatMapName(bestMapForUs.name) : "—"
                }
                valueClass="text-[#ff8c32]"
              />
            </div>
          </div>

          {loading && (
            <div className="mt-3 text-sm font-semibold text-slate-400">
              Loading veto history...
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-sm text-yellow-300">
              {error}. Saved match data is shown.
            </div>
          )}
        </section>

        {/* VETO FLOW — this team's own ban order, the main section */}
        <div className="mt-4">
          <BanOrderFlow
            eyebrow="Veto flow"
            title="How this team bans"
            description="The order this team drops maps in their own veto — the first ban is their strongest signal of what they want off the table."
            banOrderStats={ourBanOrder}
            barClass="bg-gradient-to-r from-[#ff8c32] to-[#ffb066]"
            loading={loading}
            emptyMessage="No veto data available for this team yet."
          />
        </div>

        {/* OPPONENT TENDENCIES */}
        <div className="mt-4">
          <BanOrderFlow
            eyebrow="Opponent tendencies"
            title="How opponents veto against this team"
            description="The order opponents drop maps when facing this team — a map almost always banned first is the one they fear least prepping for."
            banOrderStats={opponentBanOrder}
            barClass="bg-gradient-to-r from-rose-500 to-rose-400"
            loading={loading}
            emptyMessage="No veto data available for this team yet."
          />
        </div>

        {/* MAP POOL */}
        <section className="mt-4">
          <div className="mb-3">
            <SectionEyebrow>Map pool</SectionEyebrow>
          </div>

          {vetoStats.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {vetoStats.map((map) => (
                <MapCard
                  key={map.name}
                  map={map}
                  form={mapFormByName[map.name.toLowerCase()]}
                  slug={slug}
                />
              ))}
            </div>
          ) : (
            !loading && (
              <div className="rounded-xl border border-white/5 bg-[#111923] py-10 text-center text-sm text-slate-500">
                No veto data available for this team yet.
              </div>
            )
          )}
        </section>

        {/* MATCH HISTORY */}
        <section className="mt-4 mb-6">
          <div className="mb-3">
            <SectionEyebrow>Match history</SectionEyebrow>
          </div>

          {sortedVetoMatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {sortedVetoMatches.map((match) => (
                <MatchHistoryCard
                  key={match.matchId || match.id}
                  match={match}
                />
              ))}
            </div>
          ) : (
            !loading && (
              <div className="rounded-xl border border-white/5 bg-[#111923] py-10 text-center text-sm text-slate-500">
                No matches with veto data yet.
              </div>
            )
          )}
        </section>
      </div>
    </main>
  );
}

export default VetoPage;
