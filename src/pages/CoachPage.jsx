import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { getCoachSeo } from '../utils/coachSeo.js';
import useCoachData from '../hooks/useCoachData.js';
import CountryFlag from '../components/CountryFlag.jsx';
import { coachTx as tx } from '../i18n/coachTranslate.js';
import { tf } from '../i18n/translate.js';
import { playerRolePath } from '../utils/profileRoles.js';
import ProfileRoleTabs from '../components/ProfileRoleTabs.jsx';
import { currentLocale } from '../i18n/languages.js';
import './PlayerPage.css';
import './CoachPage.css';

const formatDate = (value, options = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat(currentLocale(), /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? { ...options, timeZone: 'UTC' } : options).format(new Date(value));
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

function ResultsCard({ label, results }) {
  return <div className="coach-rate-card">
    <small>{tx(label)}</small>
    <strong>{results.total ? rate(results.won, results.total) : '—'}</strong>
    <span>{results.won} {tx('Wins')} · {results.lost} {tx('Losses')}
      {results.drawn > 0 && ` · ${results.drawn} ${tx('Draws')}`}</span>
  </div>;
}

function CoachStats({ stats }) {
  const [scope, setScope] = useState('career');
  const selected = scope === 'recent' ? stats.recent
    : stats.teams.find(({ team }) => team.id === scope) || stats.career;
  const { matches, maps, pool, rounds } = selected;
  return <div className="coach-stack">
    <section className="coach-panel coach-stats">
      <header>
        <h2>{tx('Team statistics')}</h2>
        <label className="coach-stats-filter"><span>{tx('Sample')}</span>
          <select value={scope} onChange={event => setScope(event.target.value)}>
            <option value="career">{tx('Tracked career')}</option>
            <option value="recent">{tx('Last 90 days')}</option>
            {stats.teams.map(({ team }) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
      </header>
      <div className="coach-rate-grid">
        <ResultsCard label="Match win rate" results={matches} />
        <ResultsCard label="Map win rate" results={maps} />
        <div className="coach-rate-card">
          <small>{tx('Maps played')}</small><strong>{maps.total}</strong>
          <span>{tx('Matches')}: {matches.total}</span>
        </div>
      </div>
      <p className="coach-note">{tx('Match win rate excludes technical results. Map win rate uses only verified scores.')}</p>
    </section>
    <Panel title={tx('Map pool')} subtitle={tx('Verified map results')}>
      {pool.length ? <div className="coach-pool" role="region" tabIndex={0} aria-label={tx('Map pool')}>
        <table>
          <thead><tr>{['Map', 'Played', 'Wins', 'Losses', ...(maps.drawn ? ['Draws'] : []), 'Map win rate', 'Round win rate']
            .map(label => <th scope="col" key={label}>{tx(label)}</th>)}</tr></thead>
          <tbody>{pool.map(map => <tr key={map.name}>
            <th scope="row">{tx(map.name)}</th><td>{map.total}</td><td>{map.won}</td><td>{map.lost}</td>
            {maps.drawn > 0 && <td>{map.drawn}</td>}
            <td><span className="coach-pool-rate">{rate(map.won, map.total)}
              <span aria-hidden="true" style={{ '--win-rate': `${100 * map.won / map.total}%` }} /></span></td>
            <td title={`${map.roundsWon} / ${map.roundsPlayed}`}>{rate(map.roundsWon, map.roundsPlayed)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="coach-note">{tx('No verified map results yet.')}</p>}
    </Panel>
    {rounds.covered > 0 && <Panel title={tx('Demo round statistics')} subtitle={`${tx('Maps with demos')}: ${rounds.covered} / ${maps.total}`}>
      {[['ct', 'CT round win rate'], ['t', 'T round win rate'], ['pistol', 'Pistol round win rate']].map(([key, label]) =>
        rounds[key].total > 0 && <Stat key={key} name={tx(label)} value={rate(rounds[key].won, rounds[key].total)}
          detail={`${tx('Rounds')}: ${rounds[key].won} / ${rounds[key].total}`} />)}
    </Panel>}
  </div>;
}

function Overview({ profile }) {
  return <>
    <div className="coach-columns coach-overview">
      {profile.stats && <CoachStats stats={profile.stats} />}
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
    <p className="coach-footnote">{tx(profile.rosterBased ? 'Team results during confirmed coaching periods.' : profile.assignment
      ? 'Team results during the coaching periods provided by the coach.'
      : 'Only matches with the coach confirmed by FACEIT are counted.')}</p>
  </>;
}

function Career({ profile }) {
  const { roster, periods, team, observedAt } = profile;
  const [selection, setSelection] = useState(null);
  const selected = periods.find(period => period.key === selection) || periods[0];
  const timelinePeriods = periods.slice().sort((a, b) => Date.parse(a.first) - Date.parse(b.first));
  const start = Math.min(...periods.map(period => Date.parse(period.first)));
  const end = Math.max(...periods.map(period => Date.parse(period.last)), start + 86400000);
  const position = value => Math.max(2, Math.min(98, 2 + 96 * (Date.parse(value) - start) / (end - start)));
  const dates = period => {
    if (period.assignment?.current) return `${formatDate(period.first)} — ${tx('Present')}`;
    return period.first === period.last ? formatDate(period.first) : `${formatDate(period.first)} — ${formatDate(period.last)}`;
  };
  const departure = period => {
    if (period.assignment) return null;
    const bounds = profile.historyBounds?.find(row => row.team_id === period.team.id && row.season === period.season)?.evidence;
    if (!bounds?.after) return null;
    return <small title={tx('Match-room evidence does not establish a contract end date.')}>
      {tx('Coach slot changed')}: {formatDate(bounds.last.date)} — {formatDate(bounds.after.date)}
    </small>;
  };
  return <div className="coach-stack">
    <div className="coach-career-stats">
      <div><span>{tx('Teams')}</span><strong>{new Set([team.id, ...periods.map(period => period.team.id)]).size}</strong></div>
      <div><span>{tx(profile.assignment ? 'Matches' : 'Confirmed matches')}</span><strong>{periods.reduce((sum, period) => sum + period.matches, 0)}</strong></div>
      <div><span>{tx(profile.assignment ? 'Latest match' : 'Latest confirmation')}</span><strong className="coach-date">{formatDate(observedAt)}</strong></div>
    </div>
    {!!roster.length && <Panel title={tx('Lineup from the match room')} subtitle={team.name}>
      <div className="coach-roster">{roster.map(player =>
        <Link className="coach-player" key={player.id} to={`/player/${encodeURIComponent(player.nickname)}`}>
          {team.logo && <img className="coach-watermark" src={team.logo} alt="" />}
          <img className="coach-silhouette" src="/player-silhouette.png" alt="" loading="lazy" />
          <strong>{player.nickname}</strong>
        </Link>)}</div>
    </Panel>}
    {!!profile.registeredTeams?.length && <Panel title={tx('ESEA roster confirmations')}>
      {profile.registeredTeams.map(({ team, season, observedAt }) => <div className="coach-row" key={`${team.id}:${season}`}>
        <Link className="coach-team-inline" to={teamPath(team)}><TeamLogo team={team} />
          <span><b>{team.name}</b><small>{tx('Season')} {season}</small></span></Link>
        <small>{formatDate(observedAt)}</small>
      </div>)}
    </Panel>}
    <Panel title={tx('Team history')} subtitle={tx(profile.assignment ? 'Matches' : 'Confirmed matches')}>
      {periods.length ? periods.map(period =>
        <div className="coach-row" key={period.key}>
          <Link className="coach-team-inline" to={teamPath(period.team)}><TeamLogo team={period.team} />
            <span><b>{period.team.name}</b><small>{dates(period)}</small></span></Link>
          <span className="text-right"><strong title={tx(period.assignment && period.assignment.startSource !== 'first_observed' ? 'Days in team' : 'Observed span')}>{tf('{0} d', period.days)}</strong>
            {period.winRate != null && <small>{tx('Win rate')}: {rate(period.winRate, 1)}</small>}
            <small>{period.season ? `${tx('Season')} ${period.season} · ` : ''}{tx('Matches')}: {period.matches}</small>
            {departure(period)}
            {period.assignment && period.mapTotals.played > 0 && <small>{tx('Maps')}: {period.mapTotals.played} · {tx('Win rate')}: {rate(period.mapTotals.won, period.mapTotals.played)}</small>}</span>
        </div>) : <p className="coach-note">{tx('No completed matches confirmed yet.')}</p>}
    </Panel>
    {selected && <Panel title={tx('Coaching timeline')}>
      <div className="coach-timeline">
        <div className="coach-axis"><span>{formatDate(new Date(start))}</span>{end - start > 86400000 && <span>{formatDate(new Date(end))}</span>}</div>
        {timelinePeriods.map(period => <div className="coach-track" key={period.key}>
          <span>{period.team.name}</span>
          <div><button type="button" title={dates(period)} aria-label={`${period.team.name}, ${dates(period)}`}
            aria-pressed={selected.key === period.key} onClick={() => setSelection(period.key)}
            style={{ '--start': `${position(period.first)}%`, '--span': `${position(period.last) - position(period.first)}%` }}>
            {position(period.last) - position(period.first) >= 12 && <span className="coach-track-days" aria-hidden="true">{tf('{0} d', period.days)}</span>}
          </button></div>
        </div>)}
        <div className="coach-selection"><TeamLogo team={selected.team} /><div><b>{selected.team.name}</b>
          <small>{dates(selected)} · {tf('{0} d', selected.days)} · {tx('Matches')}: {selected.matches}</small></div></div>
      </div>
    </Panel>}
    <p className="coach-footnote">{tx(profile.rosterBased ? 'Returns are separate periods. Unknown start dates use the first confirmation.' : profile.assignment ? 'Coaching periods provided by the coach.' : 'Dates show the first and last confirmed match, not the full coaching contract.')}</p>
  </div>;
}

export default function CoachPage({ playerRoute = false }) {
  const { coachId, playerId } = useParams();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const response = useCoachData(playerRoute ? 'player' : 'id', playerRoute ? playerId : coachId);
  const profile = response?.data;
  const tab = params.get('tab') === 'teams' ? 'teams' : 'overview';
  function selectTab(nextTab) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (nextTab === 'teams') next.set('tab', 'teams');
      else next.delete('tab');
      return next;
    }, { replace: true });
  }

  useEffect(() => {
    if (!response) return;
    window.dispatchEvent(new CustomEvent('coach-seo-update', {
      detail: { ...getCoachSeo(coachId || playerId, profile, undefined, response.status === 404), routePath: pathname },
    }));
  }, [coachId, playerId, pathname, profile, response]);

  if (!profile) return <div className="player-profile px-5 py-16 text-center text-slate-300" role="status">
    {!response ? tx('Loading...') : response.status === 404 ? tx('Coach profile not found') : tx('Coach data temporarily unavailable')}
  </div>;

  if (profile.playerNickname && !playerRoute) {
    return <Navigate replace to={playerRolePath(profile.playerNickname, 'coach', tab)} />;
  }
  const { team, maps } = profile;
  const career = profile.stats?.career;
  return <div className="player-profile coach-profile min-h-screen text-white">
    <main className="player-profile-shell mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <Link className="coach-back" to={teamPath(team)}>← {team.name}</Link>
      <section className="player-hero relative mt-4 overflow-hidden border">
        <div className="player-hero-grid relative grid">
          <div>
            <div className="player-portrait coach-portrait">
              {team.logo && <img src={team.logo} alt="" className="absolute inset-0 h-full w-full scale-[1.3] object-contain opacity-[0.08] grayscale" />}
              <img src="/player-silhouette.png" alt="" className="relative z-10 h-[92%] object-contain" />
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
              <span><small>{tx(profile.rosterBased ? 'Confirmed in ESEA roster' : profile.assignment ? 'Coaching team' : 'Confirmed in match room')}</small><b>{team.name} ↗</b></span>
            </Link>
          </div>
          <div className="coach-metrics">
            <div className="coach-metric coach-metric-primary"><small>{tx(career ? 'Match win rate' : 'Team map win rate')} · {tx(career ? 'Tracked career' : 'Last 90 days')}</small>
              <strong>{career ? (career.matches.total ? rate(career.matches.won, career.matches.total) : '—') : (maps.total ? rate(maps.won, maps.total) : '—')}</strong><span>{career ? tx('Matches') : tx('Maps')}: {career ? career.matches.total : maps.total}</span></div>
            {profile.tenure && <div className="coach-metric"><small>{tx(profile.tenure.startSource === 'first_observed' || profile.tenure.source === 'match_rooms' ? 'Observed span' : 'Days in team')}</small>
              <strong>{tf('{0} d', profile.tenure.days)}</strong><span>{formatDate(profile.tenure.first)} — {profile.tenure.current ? tx('Present') : formatDate(profile.tenure.last)}</span></div>}
            {!profile.tenure && <div className="coach-metric"><small>{tx(profile.assignment ? 'Latest match' : 'Latest confirmation')}</small><strong>{formatDate(profile.observedAt)}</strong></div>}
          </div>
        </div>
      </section>
      {profile.playerNickname && <ProfileRoleTabs nickname={profile.playerNickname} active="coach" tab={tab} />}
      <nav className={`player-section-nav ${tab === 'teams' ? 'showing-teams' : ''}`} aria-label={tx('Coach profile')}>
        <button type="button" aria-pressed={tab === 'overview'} onClick={() => selectTab('overview')}>{tx('Overview')}</button>
        <button type="button" aria-pressed={tab === 'teams'} onClick={() => selectTab('teams')}>{tx('Teams')}</button>
      </nav>
      <div className="coach-content">{tab === 'teams' ? <Career key={profile.id} profile={profile} /> : <Overview profile={profile} />}</div>
    </main>
  </div>;
}
