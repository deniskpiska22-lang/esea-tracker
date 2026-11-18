import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Link from '../components/SiteLink.jsx';
import { fixTx as tx } from '../i18n/siteFixes.js';
import { useTeamCatalog } from '../hooks/useTeamCatalog.js';
import { useUserTimeSettings } from '../hooks/useUserTimeSettings.js';
import { formatUserDateTime } from '../utils/userTime.js';
import { matchKind, compareUpcomingMatches } from '../utils/teamMatchFeed.js';
import { upcomingDivision, UPCOMING_DIVISIONS } from '../utils/upcomingDivisions.js';
import { matchPublicPath } from '../utils/matchUrls.js';
import { matchTeamSource, resolveMatchTeam } from '../utils/matchTeamIdentity.js';

export default function MatchDirectoryPage() {
  useUserTimeSettings();
  const { teams } = useTeamCatalog();
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(null);
  const division = UPCOMING_DIVISIONS.includes(params.get('division')) ? params.get('division') : '';
  const status = ['live','upcoming','finished'].includes(params.get('status')) ? params.get('status') : '';
  const search = (params.get('q') || '').slice(0,80);
  const key = JSON.stringify([division,search,status]);
  const limit = page?.key === key ? page.limit : 100;
  function change(name,value) {
    setParams(previous => { const next = new URLSearchParams(previous); if(value) next.set(name,value); else next.delete(name); return next; },{replace:true});
  }
  useEffect(() => {
    let stopped = false;
    let active;
    async function load() {
      if (active || document.hidden) return;
      const controller = new AbortController(); active = controller;
      const timeout = setTimeout(()=>controller.abort(),15000);
      try {
        const response = await fetch('/api/home-matches?view=directory',{signal:controller.signal});
        if (!response.ok) throw new Error('Match feed unavailable');
        const data = await response.json();
        if (!data.ok || !Array.isArray(data.rows)) throw new Error('Invalid match feed');
        if (!stopped) setResult({rows:data.rows,error:false});
      } catch { if (!stopped) setResult(previous=>({rows:previous?.rows || [],error:true})); }
      finally { clearTimeout(timeout); active = null; }
    }
    void load();
    const timer=setInterval(load,60000);
    document.addEventListener('visibilitychange',load);
    return ()=>{stopped=true;clearInterval(timer);active?.abort();document.removeEventListener('visibilitychange',load);};
  },[retry]);
  const rows = useMemo(() => (result?.rows || []).map(row=>{
    const source=matchTeamSource(row);
    const team = side=>resolveMatchTeam(teams,{id:row[`team${side}_id`],name:row[`team${side}_name`],slug:row[`team${side}_slug`],logo:row[`team${side}_logo`]},source);
    return {...row,kind:matchKind(row) || 'live',team1:team(1),team2:team(2)};
  }).filter(row=>(!status || row.kind===status) && (!division || upcomingDivision(row)===division) &&
    `${row.team1.name} ${row.team2.name} ${row.competition_name}`.toLowerCase().includes(search.trim().toLowerCase())),[result,teams,division,search,status]);
  const active=rows.filter(row=>row.kind!=='finished').sort(compareUpcomingMatches);
  const finished=rows.filter(row=>row.kind==='finished').sort((a,b)=>String(b.finished_at || b.scheduled_at).localeCompare(String(a.finished_at || a.scheduled_at)));
  const sections=[[tx('Live matches'),active.filter(row=>row.kind==='live')],[tx('Upcoming Matches'),active.filter(row=>row.kind==='upcoming')],[tx('Recent results'),finished]];
  let displayed=0;
  return <main className="mx-auto max-w-6xl px-4 py-8 text-white">
    <h1 className="text-3xl font-black">{tx('Match schedule and results')}</h1>
    <div className="my-6 grid gap-3 sm:grid-cols-3">
      <label className="grid gap-2 text-sm text-slate-400">{tx('Division')}<select className="min-h-11 min-w-0 rounded-xl border border-slate-700 bg-[#111923] px-3 text-white" value={division} onChange={e=>change('division',e.target.value)}>
        <option value="">{tx('All divisions')}</option>{UPCOMING_DIVISIONS.map(d=><option key={d}>{d}</option>)}
      </select></label>
      <label className="grid gap-2 text-sm text-slate-400">{tx('Status')}<select className="min-h-11 min-w-0 rounded-xl border border-slate-700 bg-[#111923] px-3 text-white" value={status} onChange={e=>change('status',e.target.value)}>
        <option value="">{tx('All matches')}</option><option value="live">{tx('Live matches')}</option><option value="upcoming">{tx('Upcoming Matches')}</option><option value="finished">{tx('Recent results')}</option>
      </select></label>
      <label className="grid gap-2 text-sm text-slate-400">{tx('Search')}<input className="min-h-11 min-w-0 rounded-xl border border-slate-700 bg-[#111923] px-3 text-white" type="search" maxLength={80} value={search} onChange={e=>change('q',e.target.value)} /></label>
    </div>
    {result?.error && <div role="alert" className="my-5 rounded-xl border border-slate-700 p-4 text-slate-300">{tx('Automatic statistics are temporarily unavailable')} <button className="ml-3 min-h-11 text-orange-400" onClick={()=>setRetry(n=>n+1)}>{tx('Retry loading')}</button></div>}
    {!result ? <p role="status">{tx('Loading...')}</p> : !rows.length && !result.error ? <p role="status">{tx('No matches found')}</p> : sections.map(([title,matches])=>{
      const visible=matches.slice(0,Math.max(0,limit-displayed)); displayed+=matches.length;
      return visible.length>0 && <section key={title} className="my-7">
        <h2 className="mb-3 text-lg font-bold">{title} <span className="text-sm text-slate-400">({matches.length})</span></h2>
        <div className="grid gap-3">{visible.map(row=>{
          const date=row.scheduled_at || row.started_at || row.finished_at;
          const kind=row.kind;
          const score=kind==='upcoming' ? 'vs' : row.team1_score!=null && row.team2_score!=null ? `${row.team1_score} : ${row.team2_score}` : '—';
          return <Link key={row.id} to={matchPublicPath({...row,team1_name:row.team1.name,team2_name:row.team2.name})} className="rounded-xl border border-slate-800 bg-[#101923] p-4 hover:border-orange-500/50">
            <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{date ? formatUserDateTime(date,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : tx('Date TBD')}</span><span>{kind==='live' && <b className="mr-2 text-red-400">{tx('Live')}</b>}{row.competition_name}</span></div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 font-bold"><span className="[overflow-wrap:anywhere]">{row.team1.name || 'TBD'}</span><strong className="whitespace-nowrap text-orange-400">{score}</strong><span className="text-right [overflow-wrap:anywhere]">{row.team2.name || 'TBD'}</span></div>
          </Link>;
        })}</div>
      </section>;
    })}
    {rows.length>limit && <button className="min-h-11 rounded-xl border border-slate-700 px-6 text-orange-400" onClick={()=>setPage({key,limit:limit+100})}>{tx('Load more')} · {limit} / {rows.length}</button>}
    <p className="mt-6 text-xs text-slate-500">{tx('Recent results are limited to the latest 250 completed matches.')}</p>
  </main>;
}
