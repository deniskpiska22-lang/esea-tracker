import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { getCoachSeo } from '../utils/coachSeo.js';
import useCoachData from '../hooks/useCoachData.js';
import CountryFlag from '../components/CountryFlag.jsx';
import { coachTx as tx } from '../i18n/coachTranslate.js';
import { currentLocale } from '../i18n/languages.js';
import './PlayerPage.css';
import './CoachPage.css';

const formatDate = (value, options = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat(currentLocale(), options).format(new Date(value));
const rate = (won, total) => new Intl.NumberFormat(currentLocale(), { style: 'percent', maximumFractionDigits: 1 }).format(won / total);
const teamPath = team => `/teams/${encodeURIComponent(team.slug || team.id)}`;

function TeamLogo({ team }) {
  return <span className="coach-logo" aria-hidden="true">
    {team.logo ? <img src={team.logo} alt="" /> : (team.name || 'ESEA').slice(0, 2)}
  </span>;
}
function Panel({ title, subtitle, children }) {
  return <section className="coach-panel">
    <header><h2>{title}</h2>{subtitle && <small>{subtitle}</small>}</header>
    {children}
  </section>;
}
function Stat({ name, value, detail }) {
  return <div className="coach-row"><div>{name}{detail && <small>{detail}</small>}</div><strong>{value}</strong></div>;
}

function Overview({ profile }) {
  const { maps, rounds } = profile;
  return <>
    <div className="coach-columns">
      <Panel title={tx('Team statistics')} subtitle={tx('Last 90 days')}>
        {maps.total ? <>
          <Stat name={tx('Map win rate')} value={rate(maps.won, maps.total)} detail={`${tx('Maps')}: ${maps.total}`} />
          {['ct', 't'].map(side => rounds[side].total > 0 && <Stat key={side}
            name={side === 'ct' ? tx('CT round win rate') : tx('T round win rate')}
            value={rate(rounds[side].won, rounds[side].total)}
            detail={`${tx('Rounds')}: ${rounds[side].total}`} />)}
          {[maps.best, maps.worst].map((map, index) => map && <Stat key={map.name}
            name={index === 0 ? tx('Best map') : tx('Worst map')} value={`${tx(map.name)} · ${rate(map.won, map.total)}`}
            detail={`${tx('Maps')}: ${map.total}`} />)}
        </> : <p className="coach-note">{tx('No verified map results yet.')}</p>}
      </Panel>
      <Panel title={tx('Upcoming and recent matches')}>
        {profile.matches.map(match => {
          const won = match.ownScore > match.otherScore;
          const hasScore = match.ownScore != null && match.otherScore != null;
          return <Link className="coach-row coach-match" key={`${match.id}:${match.team.id}`} to={`/match/${match.id}`}>
            <span><b>{match.team.name} vs {match.opponent}</b><small>{match.event} · {formatDate(match.date)}</small></span>
            <strong className={match.finished && hasScore ? won ? 'coach-positive' : match.ownScore < match.otherScore ? 'coach-negative' : '' : ''}>
              {match.finished ? hasScore ? `${match.ownScore} : ${match.otherScore}` : '—' : formatDate(match.date, { hour: '2-digit', minute: '2-digit' })}
            </strong>
          </Link>;
        })}
      </Panel>
    </div>
    {!!profile.mapHistory?.length && (
      <details className="coach-panel coach-map-history">
        <summary>{tx('Map results')}</summary>
        {profile.mapHistory.map(map => (
          <Link className="coach-row coach-match" key={`${map.id}:${map.team}:${map.map}`} to={`/match/${map.id}`}>
            <span><b>{tx(map.map)}</b><small>{map.team} vs {map.opponent} · {formatDate(map.date)}</small></span>
            <strong className={map.ownScore > map.otherScore ? 'coach-positive' : map.ownScore < map.otherScore ? 'coach-negative' : ''}>
              {map.ownScore} : {map.otherScore}
            </strong>
          </Link>
        ))}
      </details>
    )}
    <p className="coach-footnote">{tx('Only matches with the coach confirmed by FACEIT are counted.')}</p>
  </>;
}

function Career({ profile }) {
  const { roster, periods, team, observedAt } = profile;
  const [selection, setSelection] = useState(null);
  const selected = periods.find(period => period.key === selection) || periods[0];
  const start = Math.min(...periods.map(period => Date.parse(period.first)));
  const end = Math.max(...periods.map(period => Date.parse(period.last)), start + 86400000);
  const position = value => Math.max(2, Math.min(98, 2 + 96 * (Date.parse(value) - start) / (end - start)));
  const dates = period => period.first === period.last ? formatDate(period.first) : `${formatDate(period.first)} — ${formatDate(period.last)}`;
  return <div className="coach-stack">
    <div className="coach-career-stats">
      <div><span>{tx('Teams')}</span><strong>{new Set([team.id, ...periods.map(period => period.team.id)]).size}</strong></div>
      <div><span>{tx('Confirmed matches')}</span><strong>{periods.reduce((sum, period) => sum + period.matches, 0)}</strong></div>
      <div><span>{tx('Latest confirmation')}</span><strong className="coach-date">{formatDate(observedAt)}</strong></div>
    </div>
    {!!roster.length && <Panel title={tx('Lineup from the match room')} subtitle={team.name}>
      <div className="coach-roster">{roster.map(player =>
        <Link className="coach-player" key={player.id} to={`/player/${encodeURIComponent(player.nickname)}`}>
          {team.logo && <img className="coach-watermark" src={team.logo} alt="" />}
          <img className="coach-silhouette" src="/player-silhouette.png" alt="" loading="lazy" />
          <strong>{player.nickname}</strong>
        </Link>)}</div>
    </Panel>}
    <Panel title={tx('Team history')} subtitle={tx('Confirmed matches')}>
      {periods.length ? periods.map(period =>
        <div className="coach-row" key={period.key}>
          <Link className="coach-team-inline" to={teamPath(period.team)}><TeamLogo team={period.team} />
            <span><b>{period.team.name}</b><small>{dates(period)}</small></span></Link>
          <span>{period.season ? `${tx('Season')} ${period.season}` : `${tx('Matches')}: ${period.matches}`}</span>
        </div>) : <p className="coach-note">{tx('No completed matches confirmed yet.')}</p>}
    </Panel>
    {selected && <Panel title={tx('Coaching timeline')}>
      <div className="coach-timeline">
        <div className="coach-axis"><span>{formatDate(new Date(start))}</span>{end - start > 86400000 && <span>{formatDate(new Date(end))}</span>}</div>
        {periods.map(period => <div className="coach-track" key={period.key}>
          <span>{period.team.name}</span>
          <div><button type="button" title={dates(period)} aria-label={`${period.team.name}, ${dates(period)}`}
            aria-pressed={selected.key === period.key} onClick={() => setSelection(period.key)}
            style={{ '--start': `${position(period.first)}%`, '--span': `${position(period.last) - position(period.first)}%` }} /></div>
        </div>)}
        <div className="coach-selection"><TeamLogo team={selected.team} /><div><b>{selected.team.name}</b>
          <small>{dates(selected)} · {tx('Matches')}: {selected.matches}</small></div></div>
      </div>
    </Panel>}
    <p className="coach-footnote">{tx('Dates show the first and last confirmed match, not the full coaching contract.')}</p>
  </div>;
}

export default function CoachPage() {
  const { coachId } = useParams();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const response = useCoachData('id', coachId);
  const profile = response?.data;
  const tab = params.get('tab') === 'teams' ? 'teams' : 'overview';

  useEffect(() => {
    if (!response) return;
    window.dispatchEvent(new CustomEvent('coach-seo-update', {
      detail: { ...getCoachSeo(coachId, profile, undefined, response.status === 404), routePath: pathname },
    }));
  }, [coachId, pathname, profile, response]);

  if (!profile) return <div className="player-profile px-5 py-16 text-center text-slate-300" role="status">
    {!response ? tx('Loading...') : response.status === 404 ? tx('Coach profile not found') : tx('Coach data temporarily unavailable')}
  </div>;

  const { team, maps } = profile;
  return <div className="player-profile coach-profile min-h-screen text-white">
    <main className="player-profile-shell mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <Link className="coach-back" to={teamPath(team)}>← {team.name}</Link>
      <section className="player-hero relative mt-4 overflow-hidden border">
        <div className="player-hero-grid relative grid">
          <div>
            <div className="player-portrait coach-portrait">
              {team.logo && <img className="absolute inset-0 h-full w-full scale-[1.3] object-contain opacity-[0.08] grayscale" src={team.logo} alt="" />}
              <img className="coach-silhouette" src="/player-silhouette.png" alt="" />
            </div>
            <div className="player-social mt-2 grid">
              <a className="coach-faceit" href={`https://www.faceit.com/en/players/${encodeURIComponent(profile.nickname)}`} target="_blank" rel="noopener noreferrer">
                <img src="/logos/faceit-logo.png" alt="" /> FACEIT
              </a>
            </div>
          </div>
          <div className="coach-identity">
            <div className="coach-tags">{profile.country && <CountryFlag country={profile.country} />}<span>{tx('Coach')}</span></div>
            <h1 className="player-name font-black">{profile.nickname}</h1>
            <Link className="coach-team-card" to={teamPath(team)}><TeamLogo team={team} />
              <span><small>{tx('Confirmed in match room')}</small><b>{team.name} ↗</b></span>
            </Link>
          </div>
          <div className="coach-metrics">
            <div className="coach-metric coach-metric-primary"><small>{tx('Team map win rate')} · {tx('Last 90 days')}</small>
              <strong>{maps.total ? rate(maps.won, maps.total) : '—'}</strong><span>{tx('Maps')}: {maps.total}</span></div>
            <div className="coach-metric"><small>{tx('Latest confirmation')}</small><strong>{formatDate(profile.observedAt)}</strong></div>
          </div>
        </div>
      </section>
      <nav className={`player-section-nav ${tab === 'teams' ? 'showing-teams' : ''}`} aria-label={tx('Coach profile')}>
        <button type="button" aria-pressed={tab === 'overview'} onClick={() => setParams({})}>{tx('Overview')}</button>
        <button type="button" aria-pressed={tab === 'teams'} onClick={() => setParams({ tab: 'teams' })}>{tx('Teams')}</button>
      </nav>
      <div className="coach-content">{tab === 'teams' ? <Career key={coachId} profile={profile} /> : <Overview profile={profile} />}</div>
    </main>
  </div>;
}
