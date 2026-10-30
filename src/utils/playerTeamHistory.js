import { findCatalogTeam } from './teamIdentity.js';

const DAY = 86400000;
export function observedDays(start, end) {
  // Calendar days in UTC: a midnight boundary counts as two observed dates.
  return Math.floor(end / DAY) - Math.floor(start / DAY) + 1;
}
const number = value => value === null || value === undefined || value === '' ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;

// Consecutive appearances, not transfer dates. Never infer continuous membership
// or fill gaps from an import timestamp / nickname-based transfer list.
export function buildPlayerTeamHistory(matches, catalog) {
  const seen = new Set();
  const rows = [];
  for (const match of matches) {
    const at = Date.parse(match.date);
    if (!match.matchId || seen.has(match.matchId) || !Number.isFinite(at)) continue;
    const team = findCatalogTeam(catalog, match.teamId, match.teamName);
    const id = match.teamId || team?.faceitTeamId;
    const name = team?.name || match.teamName;
    if (!name || name === 'Unknown') continue;
    seen.add(match.matchId);
    rows.push({ match, at, team, name, identity: id ? `id:${id}` : `name:${name.trim().toLowerCase()}` });
  }
  rows.sort((a,b) => a.at-b.at || String(a.match.matchId).localeCompare(String(b.match.matchId)));
  const periods = [];
  for (const row of rows) {
    let period = periods.at(-1);
    if (!period || period.identity !== row.identity) {
      period = { key:`${row.identity}:${row.match.matchId}`, identity:row.identity, team:row.team,
        name:row.name, start:row.at, end:row.at, matches:[] };
      periods.push(period);
    }
    period.end = row.at;
    period.matches.push(row.match);
    // Prefer the latest observed name if the team is absent from the catalogue.
    period.name = row.name;
  }
  const latest = periods.at(-1);
  for (const period of periods) {
    period.latest = period === latest;
    period.days = observedDays(period.start, period.end);
    period.count = period.matches.length;
    const decided = period.matches.filter(m => number(m.teamScore) !== null && number(m.opponent?.score) !== null && Number(m.teamScore) !== Number(m.opponent.score));
    period.winRate = decided.length ? decided.filter(m => Number(m.teamScore)>Number(m.opponent.score)).length/decided.length*100 : null;
    for (const field of ['rating','adr']) {
      const values = period.matches.map(m => number(m[field])).filter(n => n !== null && n > 0);
      period[field] = values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
    }
  }
  return { periods, latest, teamCount:new Set(periods.map(p=>p.identity)).size,
    matchCount:rows.length, first:periods[0]?.start ?? null, last:latest?.end ?? null };
}

export function careerAxis(start, end) {
  // Padding gives a single-match career a usable, nonzero time scale.
  const span = Math.max(end-start, DAY*30);
  const min = start-span*.025;
  const max = Math.max(end, start+DAY*30)+span*.025;
  const count = max-min > DAY*730 ? 5 : 4;
  return { min, max, ticks:Array.from({length:count},(_,i)=>min+(max-min)*i/(count-1)) };
}
