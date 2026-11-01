const DAY=86400000;
const numeric=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
export function shareSnapshot(history=[]) {
  const rows=history.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.week_start||'')&&Number.isFinite(Date.parse(r.week_start))).sort((a,b)=>b.week_start.localeCompare(a.week_start));
  if(!rows.length)return null;
  const current=rows[0],date=Date.parse(current.week_start),start=new Date(date-7*DAY).toISOString().slice(0,10);
  const previous=rows.find(r=>r.week_start===start);
  const rank=numeric(current.world_rank),before=numeric(previous?.world_rank),points=numeric(current.points);
  return {date:current.week_start,start,end:current.week_start,rank:rank>0?rank:null,points,
    previousRank:before>0?before:null,change:rank>0&&before>0?before-rank:null};
}
export function shareResults(matches,teamId,start,end) {
  if(!Array.isArray(matches))return null;
  let wins=0,losses=0;const form=[],seen=new Set();
  for(const row of [...matches].sort((a,b)=>String(a.finished_at).localeCompare(String(b.finished_at)))){
    const time=Date.parse(row.finished_at);
    if(!row.id||seen.has(row.id)||!['FINISHED','MATCH_STATUS_FINISHED'].includes(row.status)||time<Date.parse(start)||time>=Date.parse(end)||!Number.isFinite(time))continue;
    if(row.team1_id!==teamId&&row.team2_id!==teamId)continue;
    seen.add(row.id);
    const a=numeric(row.team1_score),b=numeric(row.team2_score);
    // Do not present 1:0 administrative awards as played victories.
    const playedMap=(Array.isArray(row.map_scores)?row.map_scores:[]).some(m=>Math.max(Number(m.team1_score),Number(m.team2_score))>=13);
    if(a===null||b===null||a===b||(!playedMap&&Math.max(a,b)<13))continue;
    const won=row.team1_id===teamId?a>b:b>a;
    if(won)wins++;else losses++;form.push(won?'W':'L');
  }
  return {wins,losses,form:form.slice(-5)};
}
export function shareTeamUrl(team,language='en') {
  const key=team.profileSlug||team.faceitTeamId||team.slug;
  return `https://eseatracker.ru${language==='ru'?'':`/${language}`}/teams/${encodeURIComponent(key)}`;
}
