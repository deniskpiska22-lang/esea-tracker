import CoachPortrait from './CoachPortrait.jsx';
import { Link } from 'react-router-dom';
import useCoachData from '../hooks/useCoachData.js';
import { coachTx as tx } from '../i18n/coachTranslate.js';

export default function MatchCoaches({ matchId }) {
  const teams = useCoachData('match', matchId)?.data?.teams;
  if (!teams?.length) return null;
  return <section className="mx-auto my-5 w-[calc(100%-2rem)] max-w-5xl rounded-xl border border-[#293543] bg-[#111923] p-4 text-white">
    <h2 className="mb-3 font-bold">{tx('Coaching staff')}</h2>
    <div className="grid gap-3 sm:grid-cols-2">{teams.map(team => <div key={team.id}>
      <div className="mb-1 text-xs text-slate-400">{team.name}</div>
      {team.coaches.map(coach => <Link className="flex min-w-0 items-center gap-2 py-2 font-bold hover:text-orange-300"
        to={`/coach/${coach.id}`} key={coach.id}>
        <CoachPortrait teamLogo={team.logo} className="size-8 rounded-md" />
        <span className="min-w-0 break-all">{coach.nickname}</span><span aria-hidden="true">↗</span>
      </Link>)}</div>)}</div>
  </section>;
}
