import { observedDays } from '../src/utils/playerTeamHistory.js';
import { finished, upcoming } from './coachLobby.js';
import { normalizeTeamMapHistory } from '../src/utils/teamMapStats.js';
import { aggregateDemoRounds } from '../src/utils/demoRoundStats.js';

const day = 86400000;
const matchDate = match => match.finished_at || match.scheduled_at;
const season = value => Number(value?.match(/\b(?:season\s*|s)(\d+)\b/i)?.[1]) || null;
const newestFirst = (a, b) => Date.parse(b.date) - Date.parse(a.date);

export function buildCoachProfile(id, rows, catalog = new Map(), now = Date.now()) {
  const records = rows.flatMap(row => {
    const match = row.matches, date = match && matchDate(match);
    if (!match || !Number.isFinite(Date.parse(date)) ||
      !((row.terminal && finished(match.status)) || (!row.terminal && upcoming(match.status)
       && Date.parse(row.checked_at) >= now - 8 * 3600000 && Date.parse(date) > now - 12 * 3600000))) return [];
    return row.teams.flatMap(side => {
      const person = side.coaches.find(coach => coach.id === id);
      if (!person || ![match.team1_id, match.team2_id].includes(side.id)) return [];
      const first = side.id === match.team1_id, own = first ? 'team1' : 'team2', other = first ? 'team2' : 'team1';
      const isFinished = finished(match.status);
      const current = catalog.get(side.id);
      const team = { id: side.id, name: current?.name || side.name || match[`${own}_name`], logo: current?.logo || side.logo, slug: current?.slug };
      return [{ person, side, team, date, match, assignment: side.assignment, isFinished, checkedAt: row.checked_at, display: {
        id: match.id, date, team, event: match.competition_name,
        opponent: match[`${other}_name`], ownScore: match[`${own}_score`],
        otherScore: match[`${other}_score`], finished: isFinished
      } }];
    });
  }).sort(newestFirst);
  if (!records.length) return null;
  const completed = records.filter(row => row.isFinished);
  const future = records.filter(row => !row.isFinished).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const activeTeamId = records.find(row => row.assignment?.current)?.team.id;
  const featured = future.find(row => row.team.id === activeTeamId)
    || completed.find(row => row.team.id === activeTeamId) || future[0] || completed[0];
  const identity = records.slice().sort((a, b) => Math.min(now, Date.parse(b.date)) - Math.min(now, Date.parse(a.date)))[0].person;
  const periodsByKey = new Map();
  for (const row of [...completed].reverse()) {
    const s = row.assignment?.season ?? season(row.match.competition_name);
    const key = row.assignment ? `${row.team.id}:assigned:${row.assignment.season || row.assignment.start}` : `${row.team.id}:${s ?? 'unknown'}`;
    const period = periodsByKey.get(key) || {
      key, team: row.team, season: s, first: row.assignment?.start || row.date, matches: 0,
      assignment: row.assignment || null, matchRows: [],
    };
    period.last = row.date;
    period.matches++;
    period.matchRows.push(row.match);
    periodsByKey.set(key, period);
  }
  const periods = [...periodsByKey.values()]
    .map(({ matchRows, ...period }) => {
      const maps = normalizeTeamMapHistory(matchRows, period.team.id).flatMap(match => match.mapScores);
      return { ...period, days: observedDays(Date.parse(period.first), Date.parse(period.last)),
        mapTotals: { played: maps.length, won: maps.filter(map => map.teamScore > map.opponentScore).length } };
    })
    .sort((a, b) => Date.parse(b.last) - Date.parse(a.last));
  const completedByTeam = new Map();
  for (const row of completed) {
    if (!completedByTeam.has(row.team.id)) completedByTeam.set(row.team.id, { team: row.team, matches: [] });
    completedByTeam.get(row.team.id).matches.push(row.match);
  }
  const history = [...completedByTeam.values()].flatMap(({ team, matches }) =>
    normalizeTeamMapHistory(matches, team.id).map(match => ({ ...match, team }))).sort(newestFirst);
  const maps = history.filter(row => row.team.id === featured.team.id
    && Date.parse(row.date) >= now - 90 * day && Date.parse(row.date) <= now).flatMap(row => row.mapScores);
  const mapHistory = history.flatMap(row => row.mapScores.map(map => ({
    id: row.id, date: row.date, team: row.team.name, opponent: row.opponent.name,
    map: map.map, ownScore: map.teamScore, otherScore: map.opponentScore,
  }))).slice(0, 100);
  const byMap = new Map();
  for (const map of maps) {
    const count = byMap.get(map.map) || { name: map.map, total: 0, won: 0 };
    count.total++;
    count.won += Number(map.teamScore > map.opponentScore);
    byMap.set(map.map, count);
  }
  const comparison = [...byMap.values()].filter(map => map.total >= 3)
    .sort((a, b) => b.won / b.total - a.won / a.total || b.total - a.total || a.name.localeCompare(b.name));
  const observedAt = featured.assignment
    ? completed.find(row => row.team.id === featured.team.id)?.date || featured.assignment.start || featured.date
    : featured.isFinished ? featured.date : featured.checkedAt;
  return { ...identity, team: featured.team, assignment: featured.assignment || null, roster: featured.side.roster, observedAt,
    matches: [...future.slice(0, 3), ...completed.slice(0, 6)].map(row => row.display), periods,
    maps: { total: maps.length, won: maps.filter(map => map.teamScore > map.opponentScore).length,
      best: comparison[0] || null, worst: comparison.length > 1 && comparison[0].won / comparison[0].total !== comparison.at(-1).won / comparison.at(-1).total
        ? comparison.at(-1) : null },
    rounds: aggregateDemoRounds(maps), mapHistory };
}
