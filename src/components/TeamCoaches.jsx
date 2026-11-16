import { Link } from 'react-router-dom';
import useCoachData from '../hooks/useCoachData.js';
import { coachTx as tx } from '../i18n/coachTranslate.js';

export default function TeamCoaches({ teamId }) {
  const coaches = useCoachData('team', teamId)?.data?.coaches;
  if (!coaches?.length) return null;

  return (
    <section
      aria-label={tx('Coaching staff')}
      className={`mt-4 grid gap-2.5 ${coaches.length > 1 ? 'sm:grid-cols-2' : ''}`}
    >
      {coaches.map(({ id, nickname, avatar }) => (
        <Link
          key={id}
          to={`/coach/${id}`}
          className="group flex min-w-0 items-center gap-3 rounded-xl border border-[#2b3a4a] bg-linear-to-r from-[#201b18] via-[#131e2a] to-[#101923] px-3 py-2.5 text-white transition-colors hover:border-orange-400/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 sm:gap-4 sm:px-4"
        >
          <img
            className="size-12 shrink-0 rounded-lg bg-[#182532] object-cover ring-1 ring-white/10"
            loading="lazy"
            src={avatar || '/player-silhouette.png'}
            alt=""
          />
          <span className="min-w-0 grow">
            <span className="block text-[10px] font-bold tracking-widest text-[#ffb45f] uppercase">
              {tx('Coach')}
            </span>
            <strong className="block text-base font-black wrap-anywhere">{nickname}</strong>
          </span>
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-slate-400 transition-colors group-hover:bg-orange-400/10 group-hover:text-[#ffb45f]">
            <svg viewBox="0 0 20 20" fill="none" className="size-4">
              <path d="m8 5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </Link>
      ))}
    </section>
  );
}
