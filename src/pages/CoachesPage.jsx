import { useState } from 'react';
import { Link } from 'react-router-dom';
import { coachTx as tx } from '../i18n/coachTranslate.js';
import useCoachData from '../hooks/useCoachData.js';
import { playerRolePath } from '../utils/profileRoles.js';
import CountryFlag from '../components/CountryFlag.jsx';
import CoachPortrait from '../components/CoachPortrait.jsx';

export default function CoachesPage() {
  const response = useCoachData('directory', '1');
  const [query, setQuery] = useState('');
  const coaches = response?.data?.coaches || [];
  const term = query.trim().toLowerCase();
  const visible = coaches.filter(coach => [coach.nickname, coach.playerNickname, coach.team].some(value => value?.toLowerCase().includes(term)));

  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
    <header className="rounded-3xl border border-slate-700 bg-gradient-to-br from-[#203633] to-[#111923] p-6 sm:p-9">
      <p className="text-xs font-bold tracking-widest text-emerald-300">ESEA TRACKER</p>
      <h1 className="mt-2 text-4xl font-black text-white sm:text-5xl">{tx('Coaches')}</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-300">{tx('Browse coaches from FACEIT match rooms and profiles with manually added history.')}</p>
      <label className="mt-6 block max-w-md text-sm font-semibold text-slate-200">
        {tx('Find a coach or team')}
        <input type="search" value={query} onChange={event => setQuery(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-500 bg-[#0b131b] px-4 py-3 text-white" />
      </label>
    </header>
    {!response ? <p className="py-8 text-slate-300" role="status">{tx('Loading...')}</p>
      : !response.data ? <p className="py-8 text-slate-300" role="status">{tx('Coach data temporarily unavailable')}</p>
      : !visible.length ? <p className="py-8 text-slate-300" role="status">{tx('No coaches found.')}</p>
      : <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map(coach => <li key={coach.id} className="min-w-0">
          <Link to={coach.playerNickname ? playerRolePath(coach.playerNickname, 'coach') : `/coach/${coach.id}`}
            className="block h-full overflow-hidden rounded-2xl border border-slate-700 bg-[#111923] hover:border-emerald-400 focus-visible:outline-emerald-400">
            <div className="relative flex aspect-[5/4] items-end justify-center overflow-hidden bg-gradient-to-br from-[#193238] to-[#0b141e]">
              <CoachPortrait avatar={coach.avatar} teamLogo={coach.teamLogo} />
              <div className="absolute left-2 top-2 rounded bg-[#071018]/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">{tx('Coach')}</div>
            </div>
            <div className="p-3 sm:p-4">
              <p className="flex items-center gap-2 break-all font-extrabold text-white">{coach.country && <CountryFlag country={coach.country} />}{coach.nickname}</p>
              {coach.team && <p className="mt-1 break-words text-xs text-slate-300">{coach.team}</p>}
              <p className="mt-2 text-xs text-slate-400">{coach.editorial ? tx('Coaching periods provided by the coach.') : `${tx('Confirmed matches')}: ${coach.observedMatches}`}</p>
            </div>
          </Link>
        </li>)}
      </ul>}
  </main>;
}
