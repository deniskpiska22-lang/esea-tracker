// FACEIT timestamps are seconds; stored timestamps may be ISO strings or ms.
export function tournamentTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value < 1e12 ? value * 1000 : value;
  if (typeof value === 'string' && /^\d{9,13}$/.test(value)) return tournamentTimestamp(Number(value));
  return typeof value === 'string' && value ? Date.parse(value) : NaN;
}
export const completeEvent = status => /^(FINISHED|COMPLETED|ENDED|CANCELLED|CANCELED|CHAMPIONSHIP_STATUS_(FINISHED|CANCELLED))$/.test(String(status).toUpperCase());
const completeMatch = status => /^(FINISHED|MATCH_STATUS_FINISHED|CANCELLED|CANCELED|MATCH_STATUS_CANCELLED)$/.test(String(status).toUpperCase());
const activeMatch = status => /^(LIVE|ONGOING|READY|CONFIGURING|VOTING|MATCH_STATUS_(LIVE|ONGOING|READY|CONFIGURING|VOTING))$/.test(String(status).toUpperCase());
const latest = (values,now) => Math.max(0,...values.map(tournamentTimestamp).filter(value=>value>0&&value<=now));

export function resolveTournamentCompletion(meta, matches, existing, now = Date.now()) {
  if (existing && tournamentTimestamp(existing) <= now) return existing;
  const allTerminal=matches.length>0&&matches.every(match=>completeMatch(match.status));
  const expected=Number(meta?.total_rounds),maxRound=Math.max(0,...matches.map(match=>Number(match.round)||0));
  const finals=matches.filter(match=>Number(match.round)===expected);
  // A complete declared single-group final can certify the end even if the
  // organizer leaves the championship status stuck. Never infer from a gap.
  const finalDone=meta?.type==='bracket'&&Number(meta.total_groups||1)===1&&expected>0
    &&maxRound===expected&&finals.length===1&&Boolean(finals[0].results?.winner)&&allTerminal;
  if (!completeEvent(meta?.status)&&!finalDone) return null;
  if(matches.some(match=>!completeMatch(match.status))) return null;
  const finish=latest(matches.map(match=>match.finished_at),now)
    ||latest([meta?.finished_at,meta?.championship_end],now);
  // An explicitly terminal event with no games (e.g. canceled registration)
  // uses the verification time; this does not invent a match result.
  return finish ? new Date(finish).toISOString() : completeEvent(meta?.status)&&!matches.length ? new Date(now).toISOString() : null;
}

export function tournamentLifecycle(meta,matches,now=Date.now()) {
  const active=matches.filter(match=>activeMatch(match.status));
  const future=matches.filter(match=>!completeMatch(match.status)).map(match=>tournamentTimestamp(match.scheduled_at))
    .filter(value=>value>now);
  const schedule=Object.values(meta?.schedule||{}).map(item=>item?.date);
  return {sourceStatus:meta?.status||null,checkedAt:new Date(now).toISOString(),matchCount:matches.length,
    lastActivityAt:latest(matches.flatMap(match=>[match.finished_at,match.started_at,match.scheduled_at]),now)||null,
    nextMatchAt:future.length?Math.min(...future):null,
    activeMatchAt:latest(active.flatMap(match=>[match.started_at,match.scheduled_at]),now)||null,
    activeMatches:active.length,totalRounds:Number(meta?.total_rounds)||null,
    scheduledEndAt:Math.max(0,...schedule.map(tournamentTimestamp).filter(Number.isFinite))||null};
}

export function tournamentRefreshDue(row,now=Date.now()) {
  const completed=tournamentTimestamp(row.completed_at);
  if(Number.isFinite(completed)&&now-completed>3*86400000)return false;
  const last=tournamentTimestamp(row.lifecycle?.checkedAt);
  if(!Number.isFinite(last))return true;
  const start=tournamentTimestamp(row.start_date);
  const activity=Math.max(row.lifecycle?.lastActivityAt||0,row.lifecycle?.activeMatchAt||0);
  const next=row.lifecycle?.nextMatchAt||0;
  const quiet=Number.isFinite(start)&&(start>now+7*86400000
    ||start<now-30*86400000&&now-activity>7*86400000&&(!next||next>now+7*86400000));
  return now-last>=(quiet?86400000:180000);
}
