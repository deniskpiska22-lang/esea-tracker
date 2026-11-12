import Link from "../components/SiteLink.jsx";
import { findTeamByRoute } from "../utils/teamProfileUrls.js";
import { translateError } from "../i18n/translate.js";
import { tx, tf } from "../i18n/translate.js";
import { currentLocale } from "../i18n/languages.js";
import { createContext, useContext, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { useTeamCatalog } from "../hooks/useTeamCatalog.js";
import { useTeamVetoRecovery } from "../hooks/useTeamVetoRecovery.js";
import { useStaticTeamMatches } from "../hooks/useStaticHistory.js";
import {
  buildOpponentBanOrderStats,
  buildTeamBanOrderStats,
  buildVetoStats,
  useTeamStats,
} from "../hooks/useTeamStats";
import { formatMapName } from "../utils/formatMapName";
import { isActiveMap } from "../utils/activeMapPool";
import "./VetoPage.css";

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

// Only the current active map pool is used by forward-looking veto
// aggregation, so retired maps do not skew percentages.
// Match History is left untouched since it's a factual log of what
// actually happened in each past match, not a forward-looking stat.
function stripInactiveMapSteps(matches) {
  return matches.map((match) => {
    const vetoSteps = Array.isArray(match.vetoSteps)
      ? match.vetoSteps.filter((step) => isActiveMap(step.map))
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

  return new Intl.DateTimeFormat(currentLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

const VetoImages = createContext(null);

function MapThumb({ name, large = false }) {
  const images = useContext(VetoImages);
  const key = normalizeMapImageName(name);
  return (
    <img className={large ? "veto-map-art" : "veto-thumb"}
      src={images?.[key] || `/maps/${key}.png`} alt="" loading="lazy"
      onError={event => { event.currentTarget.hidden = true; }} />
  );
}

function SummaryCard({ label, map, value, tone, children }) {
  return (
    <div className={`veto-summary-card ${tone || ""}`}>
      <span>{tx(label)}</span>
      <strong>{map ? formatMapName(map.name) : value ?? "—"}</strong>
      {children && <small>{children}</small>}
    </div>
  );
}

function BanOrderFlow({ title, banOrderStats, opponent = false, loading }) {
  const groups = groupBanOrderByPosition(banOrderStats);
  return (
    <section className={`veto-flow-panel ${opponent ? "is-opponent" : ""}`}>
      <h3>{tx(title)}</h3>
      {groups.length ? groups.map(({ order, entries }, index) => (
        <details key={order} className="veto-flow-order" open={index === 0}>
          <summary>
            <span className="veto-order-index">{String(order).padStart(2, "0")}</span>
            <strong>{tx("Ban")} {order}</strong>
            <span className="veto-flow-leader">{formatMapName(entries[0].name)} · {entries[0].percent}%</span>
          </summary>
          <div className="veto-flow-entries">
            {entries.map(entry => (
              <div key={entry.name} className="veto-flow-entry">
                <MapThumb name={entry.name} />
                <span>{formatMapName(entry.name)}</span>
                <span className="veto-bar" aria-hidden="true"><i style={{ width: `${entry.percent}%` }} /></span>
                <b>{entry.percent}%</b>
              </div>
            ))}
          </div>
        </details>
      )) : !loading && <p className="veto-empty">{tx("No veto data available for this team yet.")}</p>}
    </section>
  );
}

function MatchHistoryCard({ match, teamName, preview }) {
  const id = match.matchId || match.id;
  const steps = match.vetoSteps || [];
  return (
    <details className="veto-match">
      <summary>
        <span className={`veto-result ${match.won ? "is-win" : ""}`}>{match.won ? tx("W") : tx("L")}</span>
        <span className="veto-match-meta"><strong>{match.opponentName || tx("Unknown")}</strong>
          <small>{formatDate(match.date)}{match.season ? ` · ${match.season}` : ""}</small>
        </span>
        <b className="veto-score">{match.boScore || `${match.teamScore ?? "—"} : ${match.opponentScore ?? "—"}`}</b>
      </summary>
      <div className="veto-match-expanded">
        <ol className="veto-steps">
          {steps.map((step, index) => (
            <li key={index} data-action={step.action}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <MapThumb name={step.map} />
              <div><b>{formatMapName(step.map)}</b><small>{step.side === "team" ? teamName : step.side === "opponent" ? match.opponentName : "—"}</small></div>
              <em>{tx(step.action === "Picked" ? "Pick" : step.action === "Banned" ? "Ban" : step.action)}</em>
            </li>
          ))}
        </ol>
        {preview ? <a href={`https://eseatracker.ru/match/${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">{tx("Match Information")} ↗</a>
          : <Link to={`/match/${id}`}>{tx("Match Information")} ↗</Link>}
      </div>
    </details>
  );
}

function MapCard({ map, form, slug, preview }) {
  const decided = map.winsWhenPicked + map.lossesWhenPicked;
  const content = <>
    <div className="veto-map-cover">
      <MapThumb name={map.name} large />
      <h3>{formatMapName(map.name)}</h3>
    </div>
    <div className="veto-map-body">
      <div className="veto-map-win">
        <div><span>{tx("Winrate when picked")}</span><strong>{decided ? `${map.winrateWhenPicked}%` : "—"}</strong></div>
        {decided > 0 && <small>{map.winsWhenPicked}{tx("W")} · {map.lossesWhenPicked}{tx("L")}</small>}
      </div>
      <div className="veto-map-rates">
        <span className="is-pick"><b>{map.pickRate}%</b> {tx("Pick")}</span>
        <span className="is-ban"><b>{map.banRate}%</b> {tx("Ban")}</span>
      </div>
      {form?.recent.length > 0 && <div className="veto-map-form" aria-label={tx("Recent form")}>
        {form.recent.map((won, index) => <span key={index} className={won ? "is-win" : ""}>{won ? tx("W") : tx("L")}</span>)}
        {form.recent.length >= 2 && <b className={form.trend === "up" ? "is-win" : form.trend === "down" ? "is-ban" : ""} title={tf("Recent form vs. overall — {0}", form.trend)}>{form.trend === "up" ? "↑" : form.trend === "down" ? "↓" : "→"}</b>}
      </div>}
    </div>
  </>;
  const target = `/team/${slug}/matches?map=${encodeURIComponent(map.name)}`;
  return preview
    ? <a className="veto-map-card" href={`https://eseatracker.ru${target}`} target="_blank" rel="noreferrer">{content}</a>
    : <Link className="veto-map-card" to={target}>{content}</Link>;
}

function VetoPage() {
  const { teams } = useTeamCatalog();
  const { slug } = useParams();

  const team = findTeamByRoute(teams, slug) || null;
  const matchesData = useStaticTeamMatches(team?.slug);
  const fallbackMatches = matchesData.filter(
    (match) => match.teamSlug === team?.slug
  );

  const {
    matches: teamMatches,
    loading,
    error,
    refresh,
  } = useTeamStats(slug, fallbackMatches);
  const recovering = useTeamVetoRecovery(team?.faceitTeamId, refresh);

  if (!team) return <main className="veto-page"><h1>{tx("Team not found")}</h1><Link to="/">{tx("← Back Home")}</Link></main>;
  return <VetoDashboard key={team.faceitTeamId || slug} team={team} slug={slug} matches={teamMatches} loading={loading || recovering} error={error} />;
}

export function VetoDashboard({ team, slug, matches, loading = false, error, preview = false, images = null }) {
  const [sort, setSort] = useState("pick");
  const [visibleMatches, setVisibleMatches] = useState(8);
  const recentMatches = useMemo(() => preview ? matches : matches.filter(isWithinVetoWindow), [matches, preview]);
  const eligible = useMemo(() => stripInactiveMapSteps(recentMatches), [recentMatches]);
  const mapForm = useMemo(() => buildMapFormByName(recentMatches), [recentMatches]);
  const maps = useMemo(() => buildVetoStats(eligible), [eligible]);
  const ourBans = useMemo(() => buildTeamBanOrderStats(eligible), [eligible]);
  const oppBans = useMemo(() => buildOpponentBanOrderStats(eligible), [eligible]);
  const history = useMemo(() => recentMatches.filter(match => match.vetoSteps?.length)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)), [recentMatches]);
  const decisions = map => map.winsWhenPicked + map.lossesWhenPicked;
  const favoritePick = [...maps].sort((a, b) => b.picked - a.picked).find(map => map.picked > 0);
  const favoriteBan = [...maps].sort((a, b) => b.banned - a.banned).find(map => map.banned > 0);
  const bestMap = [...maps].filter(decisions).sort((a, b) => b.winrateWhenPicked - a.winrateWhenPicked || decisions(b) - decisions(a))[0];
  const rank = map => sort === "win" ? (decisions(map) ? map.winrateWhenPicked : -1) : sort === "ban" ? map.banned : map.picked;
  const orderedMaps = [...maps].sort((a, b) => rank(b) - rank(a));
  const coverage = recentMatches.length ? history.length / recentMatches.length * 100 : 0;
  return (
    <VetoImages.Provider value={images}>
    <main className="veto-page">
      <div className="veto-shell">
        {preview ? <a className="veto-back" href={`https://eseatracker.ru/teams/${slug}`} target="_blank" rel="noreferrer">{tx("← Back to Team")}</a>
          : <Link className="veto-back" to={`/team/${slug}`}>{tx("← Back to Team")}</Link>}
        <header className="veto-hero" style={images?.nuke ? { "--veto-hero-image": `url(${images.nuke})` } : undefined}>
          <div className="veto-hero-content">
            <div className="veto-kicker"><i /> CS2 / {tx("Map veto")}</div>
            <div className="veto-team">
              {team.logo && <img src={team.logo} alt="" />}
              <div><span>{team.name}</span><h1>{tx("Veto Analytics")}</h1></div>
            </div>
            <p>{tx("Last")} {VETO_WINDOW_DAYS} {tx("days")}</p>
          </div>
          <div className="veto-summary">
            <SummaryCard label="Favorite Pick" map={favoritePick} tone="is-pick">{favoritePick && `${favoritePick.pickRate}%`}</SummaryCard>
            <SummaryCard label="Favorite Ban" map={favoriteBan} tone="is-ban">{favoriteBan && `${favoriteBan.banRate}%`}</SummaryCard>
            <SummaryCard label="Best Map" map={bestMap} tone="is-best">{bestMap && `${bestMap.winrateWhenPicked}% · ${bestMap.winsWhenPicked}${tx("W")} / ${bestMap.lossesWhenPicked}${tx("L")}`}</SummaryCard>
          </div>
          <div className="veto-coverage">
            <span>{tf("Veto data: {0} of {1} matches", history.length, recentMatches.length)}</span>
            <span className="veto-bar" aria-hidden="true"><i style={{ width: `${coverage}%` }} /></span>
          </div>
        </header>
        {loading && <p className="veto-notice" role="status">{tx("Loading veto history...")}</p>}
        {error && <p className="veto-notice">{translateError(error)}{tx(". Saved match data is shown.")}</p>}

        <section className="veto-section">
          <div className="veto-section-head"><div><div className="veto-kicker">01 / CS2</div><h2>{tx("Veto flow")}</h2></div></div>
          <div className="veto-flow-grid">
            <BanOrderFlow title="How this team bans" banOrderStats={ourBans} loading={loading} />
            <BanOrderFlow title="How opponents veto against this team" banOrderStats={oppBans} opponent loading={loading} />
          </div>
        </section>

        <section className="veto-section">
          <div className="veto-section-head">
            <div><div className="veto-kicker">02 / CS2</div><h2>{tx("Map pool")}</h2></div>
            {maps.length > 0 && <div className="veto-sort" role="group" aria-label={tx("Map pool")}>
              {[["pick", "Pick"], ["ban", "Ban"], ["win", "Win rate"]].map(([key, label]) =>
                <button key={key} type="button" aria-pressed={sort === key} onClick={() => setSort(key)}>{tx(label)}</button>)}
            </div>}
          </div>
          {maps.length > 0 ? <div className="veto-map-grid">{orderedMaps.map(map => <MapCard key={map.name} map={map}
            form={mapForm[map.name.toLowerCase()]} slug={slug} preview={preview} />)}</div>
            : !loading && <p className="veto-empty">{tx("No veto data available for this team yet.")}</p>}
        </section>

        <section className="veto-section">
          <div className="veto-section-head"><div><div className="veto-kicker">03 / CS2</div><h2>{tx("Match history")}</h2></div><span className="veto-count">{history.length}</span></div>
          {history.length ? <div className="veto-history-grid">{history.slice(0, visibleMatches).map(match =>
            <MatchHistoryCard key={match.matchId || match.id} match={match} teamName={team.name} preview={preview} />)}</div>
            : !loading && <p className="veto-empty">{tx("No matches with veto data yet.")}</p>}
          {visibleMatches < history.length && <button className="veto-more" type="button" onClick={() => setVisibleMatches(n => n + 8)}>{tx("Show more")} ↓</button>}
        </section>
      </div>
    </main>
    </VetoImages.Provider>
  );
}

export default VetoPage;
