import { useMemo, useState } from 'react';
import Link from './SiteLink.jsx';
import { tx, tf } from '../i18n/translate.js';
import { currentLocale } from '../i18n/languages.js';
import { buildPlayerTeamHistory, careerAxis } from '../utils/playerTeamHistory.js';
import { matchPublicPath } from '../utils/matchUrls.js';
import './PlayerTeamHistory.css';

const COLORS = ['#6eb4e8','#e7ad68','#a2a9ff','#7cddbf','#d29ed3'];
function TeamLogo({period}) {
  const [failed, setFailed] = useState(null);
  const url = period.team?.logo;
  return <span className="team-logo">{url && failed !== url
    ? <img src={url} alt="" loading="lazy" width="32" height="32" onError={()=>setFailed(url)}/>
    : <span>{period.name.slice(0,2).toUpperCase()}</span>}</span>;
}
function TeamName({period}) {
  const key = period.team?.profileSlug || period.team?.slug;
  return key ? <Link to={`/teams/${encodeURIComponent(key)}`}>{period.name}</Link> : <span>{period.name}</span>;
}
function date(value, full=false) {
  return new Date(value).toLocaleDateString(currentLocale(),{year:'numeric',month:full?'long':'short',...(full?{day:'numeric'}:{}),timeZone:'UTC'});
}
function decimal(value, digits=1) {
  return value === null ? '—' : value.toLocaleString(currentLocale(),{minimumFractionDigits:digits,maximumFractionDigits:digits});
}
export default function PlayerTeamHistory({matches, catalog, loading, error}) {
  const career = useMemo(()=>buildPlayerTeamHistory(matches,catalog),[matches,catalog]);
  const [selectedKey,setSelectedKey] = useState(null);
  const [openKey,setOpenKey] = useState(null);
  const [year,setYear] = useState('all');
  const availableYears = [...new Set(career.periods.flatMap(p=>[new Date(p.start).getUTCFullYear(),new Date(p.end).getUTCFullYear()]))].sort((a,b)=>b-a);
  const activeYear = year === 'all' || availableYears.includes(Number(year)) ? year : 'all';
  const filtered = career.periods.filter(p=>activeYear==='all' || (p.start<Date.UTC(Number(activeYear)+1,0,1) && p.end>=Date.UTC(Number(activeYear),0,1)));
  const selected = filtered.find(p=>p.key===selectedKey) || filtered.at(-1);
  if (loading && !career.periods.length) return <div className="player-career career-message" role="status">{tx('Loading team history…')}</div>;
  if (!career.periods.length) return <div className="player-career career-message">{error ? tx('Team history is temporarily unavailable.') : tx('No recorded team appearances yet.')}</div>;
  const start = activeYear==='all'?career.first:Date.UTC(Number(activeYear),0,1);
  const end = activeYear==='all'?career.last:Math.min(Date.UTC(Number(activeYear)+1,0,1)-1,career.last);
  const axis = careerAxis(start,end);
  const position = at => (at-axis.min)/(axis.max-axis.min)*100;
  const latestPosition = position(career.last);
  const accent = p=>p.latest?'#7cddbf':COLORS[career.periods.indexOf(p)%COLORS.length];
  const latestFirst = [...career.periods].reverse();
  return <section className="player-career" aria-label={tx('Team history')}>
    <div className="career-section-heading"><div><span className="eyebrow">{tx('RECORDED CAREER')}</span><h2>{tx('Team history')}</h2></div><span className="subtle">{date(career.first)} — {date(career.last)}</span></div>
    <div className="summary"><article><span>{tx('Teams recorded')}</span><strong>{career.teamCount}</strong><small>{tf('{0} recorded periods',career.periods.length)}</small></article><article><span>{tx('Recorded matches')}</span><strong>{career.matchCount}</strong><small>{tx('With individual statistics')}</small></article><article><span>{tx('First recorded match')}</span><strong className="first-match-date">{date(career.first)}</strong><small>{tx('History available on ESEA Tracker')}</small></article></div>
    <section className="career-panel"><div className="panel-title"><h3>{tx('Team appearances')}</h3><span>{tf('{0} recorded periods',career.periods.length)}</span></div><div className="table-scroll"><table><thead><tr><th scope="col">{tx('Recorded period')}</th><th scope="col">{tx('Team')}</th><th scope="col">{tx('Observed span')}</th><th scope="col">{tx('Matches')}</th><th scope="col">{tx('Win rate')}</th><th scope="col"><span className="sr-only">{tx('Statistics')}</span></th></tr></thead><tbody>{latestFirst.map(p=><PeriodRow key={p.key} period={p} open={openKey===p.key} onToggle={()=>{setOpenKey(openKey===p.key?null:p.key);setSelectedKey(p.key);}}/>)}</tbody></table></div></section>
    <section className="career-panel journey-panel" aria-labelledby="player-journey-title">
      <div className="journey-heading"><div><span className="eyebrow">{tx('CAREER TIMELINE')}</span><h3 id="player-journey-title">{tx('Player journey')}<span className="heading-dot">.</span></h3><p>{tx('From the first appearance to the latest recorded team')}</p></div><div className="range-control">{availableYears.length<=2?<><button type="button" aria-pressed={activeYear==='all'} onClick={()=>setYear('all')}>{tx('Full history')}</button>{availableYears.map(y=><button type="button" key={y} aria-pressed={Number(activeYear)===y} onClick={()=>setYear(String(y))}>{y}</button>)}</>:<select aria-label={tx('Timeline period')} value={activeYear} onChange={e=>setYear(e.target.value)}><option value="all">{tx('Full history')}</option>{availableYears.map(y=><option key={y} value={y}>{y}</option>)}</select>}</div></div>
      <div className="journey-scroll" tabIndex="0" role="region" aria-label={tx('Career timeline; scroll horizontally on small screens')}><div className="journey-chart"><div className="journey-label-head">{tx('TEAM / PERIOD')}</div><div className="journey-axis">{axis.ticks.map((at,i)=><span key={i} style={{left:`${position(at)}%`}}>{date(at)}</span>)}</div><div className="journey-rows">{filtered.map(p=><div key={p.key} className={`journey-row ${selected?.key===p.key?'is-selected':''}`} style={{'--accent':accent(p)}}><button type="button" className="journey-team" aria-pressed={selected?.key===p.key} onClick={()=>setSelectedKey(p.key)}><span className="chapter">{String(career.periods.indexOf(p)+1).padStart(2,'0')}</span><TeamLogo period={p}/><span><strong>{p.name}</strong><small>{p.latest?tx('Latest recorded team'):`${date(p.start)} — ${date(p.end)}`}</small></span></button><div className="journey-lane">{axis.ticks.map(at=><i key={at} className="journey-grid-line" style={{left:`${position(at)}%`}}/>)}{latestPosition>=0 && latestPosition<=100?<i className="journey-latest-line" style={{left:`${latestPosition}%`}}/>:null}<div className="journey-connection" style={{width:`${position(Math.max(p.start,start))}%`}}/><button type="button" className={`journey-period ${p.latest?'is-current':''} ${(p.end-p.start)/(axis.max-axis.min)<.10?'is-short':''}`} title={`${p.name}: ${date(p.start,true)} — ${date(p.end,true)}`} aria-label={tf('Select period: {0}',p.name)} aria-pressed={selected?.key===p.key} onClick={()=>setSelectedKey(p.key)} style={{left:`${position(Math.max(p.start,start))}%`,width:`${Math.max(.4,(Math.min(p.end,end)-Math.max(p.start,start))/(axis.max-axis.min)*100)}%`}}><span className="start-node"><TeamLogo period={p}/></span><span className="period-duration">{tf('{0} d',p.days)}</span><span className="end-node"/></button></div></div>)}</div></div></div>
      {selected?<div className="journey-selected" style={{'--accent':accent(selected)}} aria-live="polite"><div className="selected-identity"><TeamLogo period={selected}/><div><span className="eyebrow">{tx(selected.latest?'LATEST RECORDED PERIOD':'SELECTED PERIOD')}</span><strong><TeamName period={selected}/></strong><small>{date(selected.start,true)} — {date(selected.end,true)}</small></div></div><div className="selected-metric"><span>{tx('Observed span')}</span><strong>{selected.days}<small> {tx('days')}</small></strong></div><div className="selected-metric"><span>{tx('Matches')}</span><strong>{selected.count}</strong></div><div className="selected-metric"><span>{tx('Win rate')}</span><strong>{decimal(selected.winRate,0)}{selected.winRate!==null?<small>%</small>:null}</strong></div><div className="selected-metric"><span>{tx('Rating')}</span><strong>{decimal(selected.rating,2)}</strong></div></div>:null}
      <div className="journey-legend"><span><i/>{tx('Latest recorded team')}</span><span><i/>{tx('Earlier appearances')}</span><p>{tx('Select a period to see its statistics below')}</p></div>
    </section>
    <p className="data-note">{tx('Periods show the first and last recorded matches for each consecutive team, not confirmed transfer dates or continuous membership. Gaps and unrecorded matches may be missing. Statistics use recorded series, not individual maps.')}</p>
  </section>;
}
function PeriodRow({period:p,open,onToggle}) {
  const id=`career-${encodeURIComponent(p.key)}`;
  return <><tr className={p.latest?'current-row':''}><td><strong>{date(p.start)} — {date(p.end)}</strong><small>{tx(p.latest?'Latest recorded team':'Earlier appearances')}</small></td><td><div className="team-cell"><TeamLogo period={p}/><b><TeamName period={p}/></b></div></td><td>{p.days} <span className="subtle">{tx('days')}</span></td><td>{p.count}</td><td><span className={p.winRate>=50?'positive':'subtle'}>{p.winRate===null?'—':`${decimal(p.winRate,0)}%`}</span>{p.winRate!==null?<div className="win-track"><i style={{width:`${p.winRate}%`}}/></div>:null}</td><td><button type="button" className="stats-button" aria-expanded={open} aria-controls={open?id:undefined} onClick={onToggle}>{tx(open?'Hide':'Statistics')} <span aria-hidden="true">{open?'−':'↗'}</span></button></td></tr>{open?<tr className="detail-row" id={id}><td colSpan="6"><div className="period-detail"><div><small>{tx('Rating')}</small><strong>{decimal(p.rating,2)}</strong></div><div><small>ADR</small><strong>{decimal(p.adr)}</strong></div><div><small>{tx('Recorded matches')}</small><strong>{p.count}</strong></div><p>{date(p.start,true)} — {date(p.end,true)}</p></div><div className="career-recent-matches">{[...p.matches].reverse().slice(0,5).map(m=><Link key={m.matchId} to={matchPublicPath({matchId:m.matchId,teamName:m.teamName,opponentName:m.opponent?.teamName})}><span>{date(Date.parse(m.date),true)}</span><strong>{m.teamName} vs {m.opponent?.teamName || tx('Unknown')}</strong><b>{m.teamScore}:{m.opponent?.score ?? '—'}</b><span aria-hidden="true">↗</span></Link>)}</div></td></tr>:null}</>;
}
