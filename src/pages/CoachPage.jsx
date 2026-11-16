import { useParams } from 'react-router-dom';
import { FiArrowLeft, FiArrowUpRight } from 'react-icons/fi';
import Link from '../components/SiteLink.jsx';
import { CoachAvatar, CoachLink } from '../components/TeamCoaches.jsx';
import { useTeamCatalog } from '../hooks/useTeamCatalog.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { tx } from '../i18n/translate.js';
import { coachingPeriodLabel, findCoach, listCoaches } from '../utils/coachCareer.js';

const roleLabel = { coach: 'Coach', head_coach: 'Head coach', assistant_coach: 'Assistant coach' };

function Period({ period, team, locale }) {
  const slug = team?.profileSlug || team?.slug;
  const dates = coachingPeriodLabel(period, locale);
  return <li className="relative rounded-2xl border border-white/10 bg-[#111923] p-4 sm:p-5">
    <span aria-hidden="true" className="absolute -left-[25px] top-6 h-3 w-3 rounded-full border-2 border-[#090e15] bg-orange-400"/>
    <div className="flex min-w-0 items-center gap-3">
      {team?.logo && <img src={team.logo} alt="" width="38" height="38" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-contain" />}
      <div className="min-w-0">
        {dates && <p className="text-sm text-slate-300">{dates}</p>}
        <h3 className="break-words text-lg font-extrabold">{slug
          ? <Link className="hover:text-orange-300" to={`/teams/${encodeURIComponent(slug)}`}>{period.teamName}</Link>
          : period.teamName}</h3>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="text-slate-300">{tx(roleLabel[period.role] || 'Coach')}</span>
      {period.status === 'current' && <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-emerald-300">{tx('Current team')}</span>}
      {period.source && <a href={period.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-orange-300 hover:underline">{tx('Source')} <FiArrowUpRight aria-hidden="true" /></a>}
    </div>
  </li>;
}

function CoachProfile({ coach }) {
  const { locale } = useLanguage();
  const { teams } = useTeamCatalog();
  const teamById = new Map(teams.map(team => [team.faceitTeamId, team]));
  const current = coach.periods.filter(period => period.status === 'current');
  return <>
    <header className="relative overflow-hidden rounded-3xl border border-orange-400/20 bg-gradient-to-br from-[#2a211d] via-[#151d28] to-[#0c131d] p-5 sm:p-8">
      <div className="flex items-center gap-4">
        <CoachAvatar className="h-16 w-16 text-3xl" />
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-300">CS2 · {tx('Coach')}</p>
          <h1 className="break-words text-3xl font-black tracking-tight sm:text-5xl">{coach.nickname}</h1>
        </div>
      </div>
      {current.length > 0 && <p className="mt-4 text-sm text-slate-300">{tx('Current team')} · {current.map(period => period.teamName).join(', ')}</p>}
    </header>
    <section className="mt-7" aria-labelledby="coach-career-heading">
      <h2 id="coach-career-heading" className="mb-4 text-2xl font-black">{tx('Coaching career')}</h2>
      <ol className="ml-2 grid gap-3 border-l border-white/15 pl-5">
        {coach.periods.map(period => <Period key={period.id} period={period} team={period.teamId ? teamById.get(period.teamId) : undefined} locale={locale} />)}
      </ol>
      <p className="mt-4 text-sm text-slate-400">{tx('Only recorded coaching periods are shown.')}</p>
    </section>
  </>;
}

export default function CoachPage() {
  const { slug } = useParams();
  const coach = findCoach(slug);
  return <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-6 sm:px-7 sm:py-9">
    {slug && <Link to="/coaches" className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-orange-300 hover:text-orange-200"><FiArrowLeft aria-hidden="true" />{tx('Coaches')}</Link>}
    {coach ? <CoachProfile coach={coach} />
      : slug ? <h1 className="text-2xl font-bold">{tx('Coach not found')}</h1>
      : <>
        <h1 className="mb-4 text-3xl font-black">{tx('Coaches')}</h1>
        <div className="grid gap-3 sm:grid-cols-2">{listCoaches().map(row => <CoachLink key={row.slug} coach={row} label={tx('Coach')} />)}</div>
      </>}
  </main>;
}
