import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Link from '../components/SiteLink.jsx';
import TournamentNameLink from '../components/TournamentNameLink.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { tx, tf } from '../i18n/translate.js';
import { ACTIVE_MAP_POOL, normalizeMapKey } from '../utils/activeMapPool.js';
import { buildTeamMapStats, historyOpponentKey, MAP_NAMES, mapName, teamMapPath } from '../utils/teamMapStats.js';
import { getTeamMapSeo } from '../utils/teamMapSeo.js';

const PERIODS = { '30': 'Last 30 days', '90': 'Last 3 months', '180': 'Last 6 months', '365': 'Last 12 months', all: 'All time' };
const card = 'overflow-hidden rounded-2xl border border-[#263244] bg-[#101722]';
const heading = 'border-b border-white/[0.07] px-5 py-4 text-sm font-black text-slate-200';
const percent = value => value === null ? '—' : `${value.toFixed(1)}%`;

function RoundBalance({ stats }) {
  const fraction = stats.totalRounds ? stats.roundsWon / stats.totalRounds : 0;
  return <section className={card}>
    <h2 className={heading}>{tx('Round balance')}</h2>
    <div className="flex min-h-[265px] flex-col items-center justify-center gap-6 p-6">
      <div className="relative h-44 w-44" role="img" aria-label={tf('Rounds won: {0}; rounds lost: {1}', stats.roundsWon, stats.roundsLost)}>
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r="49" fill="none" stroke={stats.totalRounds ? '#38bdf8' : '#253247'} strokeWidth="15" />
          {stats.totalRounds > 0 && <circle cx="60" cy="60" r="49" fill="none" stroke="#fbbf24" strokeWidth="15" pathLength="100" strokeDasharray={`${fraction * 100} 100`} />}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><strong className="text-3xl font-black tabular-nums text-white">{percent(stats.roundWinRate)}</strong><span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{tx('Round win rate')}</span></div>
      </div>
      <div className="grid w-full grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-amber-400/5 p-3"><span className="text-xs text-slate-400">{tx('Rounds won')}</span><strong className="mt-1 block text-xl font-black text-amber-300">{stats.roundsWon}</strong></div>
        <div className="rounded-xl bg-sky-400/5 p-3"><span className="text-xs text-slate-400">{tx('Rounds lost')}</span><strong className="mt-1 block text-xl font-black text-sky-300">{stats.roundsLost}</strong></div>
      </div>
    </div>
  </section>;
}

function Filter({ label, value, onChange, children }) {
  return <label className="flex min-w-0 flex-col gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tx(label)}</span><select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-[#2b394c] bg-[#141e2b] px-3 py-2.5 text-sm font-semibold text-slate-200 outline-none focus:border-orange-400">{children}</select></label>;
}

export default function TeamMapPage() {
  const { slug, map: routeMap } = useParams();
  const [search, setSearch] = useSearchParams();
  const { locale, language } = useLanguage();
  const [loaded, setLoaded] = useState(null);
  const [retry, setRetry] = useState(0);
  const [shown, setShown] = useState(25);
  const selectedMap = mapName(routeMap);
  const validMap = Boolean(selectedMap);
  const days = Object.hasOwn(PERIODS, search.get('period')) ? search.get('period') : '90';
  const event = search.get('event') || '', opponent = search.get('opponent') || '';
  const signature = `${slug}/${routeMap}?${days}&${event}&${opponent}`;
  const [shownFor, setShownFor] = useState(signature);
  const visibleCount = shownFor === signature ? shown : 25;
  const current = loaded?.key === slug ? loaded : null;
  useEffect(() => {
    if (!validMap) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let cancelled = false;
    fetch(`/api/team-stats?action=map-history&team=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? 'not-found' : 'unavailable');
        const data = await response.json();
        if (!data.ok || !Array.isArray(data.matches) || !data.team) throw new Error('unavailable');
        if (!cancelled) setLoaded({ key: slug, data });
      }).catch(error => { if (!cancelled) setLoaded({ key: slug, error: error.message }); })
      .finally(() => clearTimeout(timer));
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [slug, validMap, retry]);
  const history = current?.data?.matches;
  const stats = useMemo(() => buildTeamMapStats(history || [], selectedMap, { days, event, opponent }), [history, selectedMap, days, event, opponent]);
  const team = current?.data?.team;
  useEffect(() => {
    if (team && selectedMap) window.dispatchEvent(new CustomEvent('team-map-seo-update', { detail: { ...getTeamMapSeo(team, selectedMap, language), routePath: `/teams/${slug}/stats/${routeMap}` } }));
  }, [team, selectedMap, slug, routeMap, language]);
  const options = useMemo(() => {
    const events = new Map(), opponents = new Map();
    for (const match of history || []) {
      events.set(match.eventId, match.event);
      const opponentKey = historyOpponentKey(match.opponent);
      if (opponentKey) opponents.set(opponentKey, match.opponent.name);
    }
    return { events: [...events].sort((a, b) => a[1].localeCompare(b[1])), opponents: [...opponents].sort((a, b) => a[1].localeCompare(b[1])) };
  }, [history]);
  const change = (key, value) => setSearch(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next; });
  if (!selectedMap || current?.error === 'not-found') return <main className="mx-auto max-w-5xl px-5 py-16 text-center text-white"><h1 className="text-2xl font-black">{tx('Map statistics not found')}</h1><Link to="/matches" className="mt-5 inline-block text-orange-400">{tx('← Back to Matches')}</Link></main>;
  if (!current || current.error || !team) return <main className="mx-auto max-w-5xl px-5 py-16 text-center text-slate-300" aria-live="polite"><p>{tx(current?.error ? 'Could not load map history. Please try again.' : 'Loading map statistics…')}</p>{current?.error && <button type="button" onClick={() => { setLoaded(null); setRetry(value => value + 1); }} className="mt-5 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white">{tx('Retry')}</button>}</main>;
  const rows = [['Times played', stats.played], ['Wins / draws / losses', `${stats.wins} / ${stats.draws} / ${stats.losses}`], ['Total rounds played', stats.totalRounds], ['Rounds won', stats.roundsWon], ['Rounds lost', stats.roundsLost], ['Win percent', percent(stats.winRate)], ['Round win rate', percent(stats.roundWinRate)]];
  const mapOptions = MAP_NAMES.filter(name => ACTIVE_MAP_POOL.includes(name) || name === selectedMap || history.some(match => match.mapScores.some(map => map.map === name)));
  const context = new URLSearchParams(search);
  const matchId = search.get('match');
  const back = /^(?:1-)?[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(matchId || '') ? `/match/${matchId}` : `/teams/${encodeURIComponent(team.profileSlug || team.faceitTeamId)}/stats`;
  const formatDate = value => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 text-white sm:px-6">
    <Link to={back} className="inline-flex items-center gap-2 text-sm font-bold text-orange-400 transition hover:text-orange-300">← {tx(matchId ? 'Back to match' : 'Map Statistics')}</Link>
    <header className={`${card} relative bg-cover bg-center`} style={{ backgroundImage: `linear-gradient(90deg,#0d1520f5,#0d1520bb),url(/maps/${normalizeMapKey(selectedMap)}.png)` }}>
      <div className="relative flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8">
        <div className="flex min-w-0 items-center gap-4">{team.logo && <img src={team.logo} alt="" className="h-16 w-16 shrink-0 object-contain" />}<div className="min-w-0"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">CS2 · {tx('Map Statistics')}</p><h1 className="break-words text-2xl font-black sm:text-3xl">{team.name} <span className="text-slate-500">/</span> {selectedMap}</h1><Link to={`/teams/${encodeURIComponent(team.profileSlug || team.faceitTeamId)}`} className="mt-2 inline-block text-xs font-semibold text-slate-400 hover:text-white">{tx('Team profile')} ↗</Link></div></div>
        <div className="text-right"><div className="text-4xl font-black tabular-nums text-orange-400">{percent(stats.winRate)}</div><div className="mt-1 text-xs text-slate-400">{tf('{0} played maps', stats.played)}</div></div>
      </div>
    </header>
    <section className={`${card} p-4 sm:p-5`} aria-label={tx('Map history filters')}>
      <div className="grid gap-4 sm:grid-cols-3"><Filter label="Event filter" value={event} onChange={value => change('event', value)}><option value="">{tx('All events')}</option>{options.events.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Filter><Filter label="Time filter" value={days} onChange={value => change('period', value)}>{Object.entries(PERIODS).map(([value, label]) => <option key={value} value={value}>{tx(label)}</option>)}</Filter><Filter label="Opponent filter" value={opponent} onChange={value => change('opponent', value)}><option value="">{tx('All opponents')}</option>{options.opponents.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Filter></div>
    </section>
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={tx('Maps')}>{mapOptions.map(name => <Link key={name} to={`${teamMapPath(team, name)}${context.size ? `?${context}` : ''}`} aria-current={name === selectedMap ? 'page' : undefined} className={`shrink-0 rounded-xl border px-5 py-3 text-sm font-black transition focus-visible:outline-2 focus-visible:outline-orange-400 ${name === selectedMap ? 'border-orange-400/40 bg-orange-500/15 text-orange-300' : 'border-white/10 bg-[#101722] text-slate-400 hover:border-white/25 hover:text-white'}`}>{name}</Link>)}</nav>
    {stats.played > 0 && stats.played < 3 && <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">{tx('Small sample: fewer than 3 played maps. Treat this win rate with caution.')}</p>}
    <div className="grid items-start gap-5 md:grid-cols-2">
      <section className={card}><h2 className={heading}>{selectedMap} · {tx('Raw statistics')}</h2><dl className="divide-y divide-white/[0.06]">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm"><dt className="text-slate-400">{tx(label)}</dt><dd className={`shrink-0 font-black tabular-nums ${label === 'Win percent' ? stats.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400' : 'text-slate-100'}`}>{value}</dd></div>)}</dl></section>
      <RoundBalance stats={stats} />
    </div>
    <section className="grid gap-4 sm:grid-cols-2" aria-label={tx('Map Picks & Bans')}>
      {[['Pick %', stats.pickRate, 'text-emerald-400'], ['Ban %', stats.banRate, 'text-rose-400']].map(([label, value, color]) => <div key={label} className={`${card} flex items-center justify-between gap-4 px-5 py-4`}><div><h2 className="text-sm font-bold text-slate-300">{tx(label)}</h2><p className="mt-1 text-xs text-slate-500">{tf('{0} known team vetoes', stats.vetoMatches)}</p></div><strong className={`text-3xl font-black tabular-nums ${color}`}>{percent(value)}</strong></div>)}
    </section>
    <details className={`${card} px-5 py-4`}><summary className="cursor-pointer text-sm font-bold text-slate-300">{tx('Detailed round statistics')}</summary><p className="mt-3 text-sm leading-6 text-slate-500">{tx('Pistol rounds, CT/T splits and opening-duel conversion are not available in the tracked data. Missing values are not counted as zero.')}</p></details>
    <section className={card}><header className={`${heading} flex items-center justify-between gap-4`}><h2>{tx('Matches')} · {selectedMap}</h2><span className="text-xs font-semibold text-slate-500">{stats.played}</span></header>
      {stats.matches.length ? <><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#182231] text-[10px] uppercase tracking-wider text-slate-500"><tr>{['Date', 'Team', 'Opponent', 'Event', 'Result'].map(label => <th key={label} scope="col" className="px-4 py-3">{tx(label)}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.05]">{stats.matches.slice(0, visibleCount).map(match => <tr key={match.id} className="transition hover:bg-white/[0.025]"><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500"><time dateTime={new Date(match.date).toISOString()}>{formatDate(match.date)}</time></td><td className="px-4 py-4 font-bold text-slate-300">{match.teamName}</td><td className="px-4 py-4"><Link to={`/teams/${encodeURIComponent(match.opponent.id || match.opponent.slug)}`} className="flex items-center gap-2 font-bold text-slate-200 hover:text-orange-300">{match.opponent.logo && <img src={match.opponent.logo} alt="" className="h-5 w-5 object-contain" />}{match.opponent.name}</Link></td><td className="max-w-[220px] px-4 py-4 text-xs text-slate-500"><TournamentNameLink name={match.event} /></td><td className="px-4 py-4"><Link to={`/match/${match.id}`} aria-label={`${match.teamName} ${match.teamScore}:${match.opponentScore} ${match.opponent.name}`} className={`inline-flex min-w-16 justify-center rounded-lg px-2 py-1.5 font-black tabular-nums transition hover:ring-1 hover:ring-current ${match.teamScore > match.opponentScore ? 'bg-emerald-400/10 text-emerald-400' : match.teamScore < match.opponentScore ? 'bg-rose-400/10 text-rose-400' : 'bg-slate-400/10 text-slate-300'}`}>{match.teamScore} : {match.opponentScore}</Link></td></tr>)}</tbody></table></div>{visibleCount < stats.matches.length && <div className="border-t border-white/5 p-4 text-center"><button type="button" onClick={() => { setShownFor(signature); setShown(visibleCount + 25); }} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5">{tx('Show more matches')}</button></div>}</> : <div className="px-5 py-12 text-center"><p className="text-sm text-slate-400">{tx('No played maps match these filters.')}</p><p className="mt-2 text-xs text-slate-500">{tx('Try another map, time period or event.')}</p></div>}
    </section>
    <p className="pb-3 text-center text-xs leading-5 text-slate-600">{tx('Only completed maps with recorded round scores are included. Technical awards are excluded.')}</p>
  </main>;
}
