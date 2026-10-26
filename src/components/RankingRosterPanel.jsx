import { useTeamRoster } from '../hooks/useTeamRoster.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { rankingRosterCopy } from '../i18n/rankingRoster.js';
import CountryFlag from './CountryFlag.jsx';
import PlayerPortrait from './PlayerPortrait.jsx';
import Link from './SiteLink.jsx';

function RosterPlayer({ player, team }) {
  const id = player.faceit_id || player.faceitId;
  const body = <>
    <PlayerPortrait player={player} alt={player.nickname} teamLogo={team.logo} showTeamBackground
      className="aspect-[4/3] w-full bg-gradient-to-b from-slate-700/30 to-[#0b111a]" />
    <span className="flex min-w-0 items-center justify-center gap-1.5 border-t border-white/5 bg-[#0b111a] px-2 py-2.5">
      <CountryFlag country={player.country} size="sm" />
      <span className="truncate text-xs font-bold text-slate-200 transition group-hover:text-orange-300" title={player.nickname}>{player.nickname || '—'}</span>
    </span>
  </>;
  const className = 'group block min-w-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#101925] transition hover:border-orange-400/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400';
  return id ? <Link to={`/players/${encodeURIComponent(id)}`} aria-label={player.nickname} className={className}>{body}</Link>
    : <div className={className}>{body}</div>;
}

export default function RankingRosterPanel({ team }) {
  const { language } = useLanguage();
  const labels = rankingRosterCopy(language);
  // Rating rows carry the immutable FACEIT team ID. Never resolve a namesake.
  const id = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(team.id || '') ? team.id : null;
  const roster = useTeamRoster(id);
  return <section aria-label={`${labels.title}: ${team.name}`} aria-busy={roster.loading}
    className="border-t border-white/[0.06] bg-gradient-to-b from-[#111b28] to-[#0b111a] p-4 sm:p-5">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{labels.title}</h3>
      {!roster.loading && !roster.error && roster.starting.length > 0 && <span className="text-xs tabular-nums text-slate-500">{roster.starting.length}/5</span>}
    </div>
    {roster.loading ? <>
      <span className="sr-only" role="status">{labels.loading}</span>
      <div aria-hidden="true" className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-3">
        {Array.from({ length: 5 }, (_, index) => <div key={index} className="aspect-[4/4] animate-pulse rounded-xl border border-white/5 bg-white/[0.04]" />)}
      </div>
    </> : roster.error ? <p role="status" className="py-5 text-sm text-slate-400">{labels.error}</p>
      : !roster.starting.length ? <p className="py-5 text-sm text-slate-400">{labels.empty}</p>
        : <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-3">
          {roster.starting.map(player => <RosterPlayer key={player.faceit_id || player.playerId} player={player} team={team} />)}
        </div>}
    <div className="mt-4 flex justify-end border-t border-white/[0.06] pt-3">
      <Link to={`/teams/${encodeURIComponent(team.id || team.slug)}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-xs font-bold text-orange-300 transition hover:border-orange-400/40 hover:bg-orange-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
        {labels.profile}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
      </Link>
    </div>
  </section>;
}
