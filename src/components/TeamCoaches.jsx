import { Link } from 'react-router-dom';
import useCoachData from '../hooks/useCoachData.js';
import { coachTx as tx } from '../i18n/coachTranslate.js';
import { currentLocale } from '../i18n/languages.js';

export default function TeamCoaches({ teamId }) {
  const data = useCoachData('team', teamId)?.data;
  if (!data?.coaches?.length) return null;
  return <section className="mt-5 rounded-[18px] border border-[#293543] bg-[#111923] p-4 text-white md:p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-black">{tx('Coaching staff')}</h2>
      <Link to={`/match/${data.matchId}`} className="text-xs text-slate-400 hover:text-orange-300">
        {tx('Confirmed in match room')} · {new Date(data.observedAt).toLocaleDateString(currentLocale())} ↗
      </Link>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">{data.coaches.map(coach =>
      <Link key={coach.id} to={`/coach/${coach.id}`}
        className="flex min-w-0 items-center gap-3 rounded-xl border border-[#293543] bg-[#0d1620] p-3 hover:border-orange-400/60">
        <img className="size-11 shrink-0 rounded-lg bg-[#162530] object-cover" loading="lazy"
          src={coach.avatar || '/player-silhouette.png'} alt="" />
        <span className="min-w-0 grow"><span className="block text-[10px] font-bold uppercase tracking-widest text-[#ffb45f]">{tx('Coach')}</span>
          <strong className="block break-all">{coach.nickname}</strong></span>
        <span aria-hidden="true" className="text-[#ffb45f]">↗</span>
      </Link>)}</div>
  </section>;
}
