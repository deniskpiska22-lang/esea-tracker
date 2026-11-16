import { FiArrowUpRight, FiHeadphones } from 'react-icons/fi';
import { tx } from '../i18n/translate.js';
import { coachesForTeam } from '../utils/coachCareer.js';
import Link from './SiteLink.jsx';

export function CoachAvatar({ className = '' }) {
  return <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-orange-400/20 bg-orange-400/10 text-xl text-orange-300 ${className}`} aria-hidden="true"><FiHeadphones /></span>;
}

export function CoachLink({ coach, label }) {
  return <Link to={`/coaches/${coach.slug}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-[#111923] px-3 py-3 text-white transition hover:border-orange-400/50 focus-visible:outline-2 focus-visible:outline-orange-400">
    <CoachAvatar />
    <span className="min-w-0 flex-1"><strong className="block break-words text-base">{coach.nickname}</strong><small className="block text-sm text-slate-400">{label}</small></span>
    <FiArrowUpRight aria-hidden="true" className="shrink-0 text-orange-300"/>
  </Link>;
}

export default function TeamCoaches({ teamId }) {
  const { current, past } = coachesForTeam(teamId);
  if (!current.length && !past.length) return null;
  return <section className="mt-5" aria-label={tx('Coaching staff')}>
    {current.length > 0 && <>
      <h2 className="mb-2 text-base font-bold text-white">{tx('Coaching staff')}</h2>
      <div className="grid gap-2 sm:grid-cols-2">{current.map(coach =>
        <CoachLink key={coach.slug} coach={coach} label={tx('Coach')} />)}</div>
    </>}
    {past.length > 0 && <details className="mt-3 rounded-xl border border-white/10 p-3">
      <summary className="cursor-pointer py-2 text-sm font-semibold text-slate-300">{tx('Former coaches')} · {past.length}</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{past.map(coach =>
        <CoachLink key={coach.slug} coach={coach} label={tx('Former coach')} />)}</div>
    </details>}
  </section>;
}
