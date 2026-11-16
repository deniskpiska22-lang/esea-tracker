import { Link } from 'react-router-dom';
import { coachTx as tx } from '../i18n/coachTranslate.js';
import { playerRolePath } from '../utils/profileRoles.js';

export default function ProfileRoleTabs({ nickname, active, tab }) {
  return <nav aria-label={tx('Profile role')}
    className="mt-4 inline-flex flex-wrap gap-1 rounded-xl border border-[#2b3a4a] bg-[#0d1620] p-1 text-sm font-bold">
    {['player', 'coach'].map(role => <Link
      key={role} to={playerRolePath(nickname, role, tab)}
      aria-current={role === active ? 'page' : undefined}
      className="rounded-lg px-4 py-2 text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 aria-[current=page]:bg-orange-400/10 aria-[current=page]:text-[#ffb45f]"
    >{tx(role === 'player' ? 'Player' : 'Coach')}</Link>)}
  </nav>;
}
