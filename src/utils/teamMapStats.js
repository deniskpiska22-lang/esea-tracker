import { ACTIVE_MAP_POOL, normalizeMapKey } from './activeMapPool.js';

export const MAP_NAMES = [...ACTIVE_MAP_POOL, 'Overpass', 'Train', 'Vertigo', 'Cobblestone'];
export const TEAM_MAP_COLUMNS = 'id,status,best_of,competition_id:raw_data->>competition_id,competition_name,scheduled_at,finished_at,team1_id,team1_name,team1_slug,team1_logo,team1_score,team2_id,team2_name,team2_slug,team2_logo,team2_score,map_scores,maps,veto_steps';
export const mapName = value => MAP_NAMES.find(name => normalizeMapKey(name) === normalizeMapKey(value)) || null;
export const historyOpponentKey = opponent => opponent?.id || (opponent?.slug ? `slug:${opponent.slug}` : opponent?.name ? `name:${opponent.name}` : '');
const list = value => {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
const score = value => value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export function teamMapPath(team, map) {
  const key = team?.profileSlug || team?.faceitTeamId || team?.id || team?.slug;
  return key && mapName(map) ? `/teams/${encodeURIComponent(key)}/stats/${normalizeMapKey(map)}` : null;
}

// Keep immutable FACEIT identity at both match and map level. Names and slugs
// alone cannot distinguish a main team from another roster with the same name.
export function normalizeTeamMapHistory(rows, teamId) {
  const seen = new Set();
  return rows.flatMap(row => {
    if (!['FINISHED', 'MATCH_STATUS_FINISHED'].includes(row.status) || !row.id || seen.has(row.id)) return [];
    if (row.team1_id !== teamId && row.team2_id !== teamId) return [];
    seen.add(row.id);
    const first = row.team1_id === teamId;
    let maps = list(row.map_scores);
    if (!maps.length && list(row.maps).length === 1 && Number(row.best_of || 1) === 1) {
      maps = [{ map: list(row.maps)[0], team1_score: row.team1_score, team2_score: row.team2_score }];
    }
    const usedMaps = new Set();
    const mapScores = maps.flatMap(item => {
      const name = mapName(item.map);
      if (!name || item.pending || usedMaps.has(name)) return [];
      const identified = Boolean(item.team1_id || item.team2_id);
      if (identified && item.team1_id !== teamId && item.team2_id !== teamId) return [];
      const ownFirst = identified ? item.team1_id === teamId : first;
      const a = score(item.team1_score ?? item.teamScore), b = score(item.team2_score ?? item.opponentScore);
      // A 1:0 award or a series score is not a played map. Keep real 13:0s.
      if (a === null || b === null || Math.max(a, b) < 13) return [];
      usedMaps.add(name);
      return [{ map: name, teamScore: ownFirst ? a : b, opponentScore: ownFirst ? b : a }];
    });
    // Exclude technical awards from both map results and veto denominators.
    if (!mapScores.length && Math.max(Number(row.team1_score), Number(row.team2_score)) <= 1) return [];
    const own = first ? 'team1' : 'team2', other = first ? 'team2' : 'team1';
    return [{
      id: row.id, date: row.finished_at || row.scheduled_at, event: row.competition_name || 'ESEA CS2',
      eventId: row.competition_id || row.competition_name || 'ESEA CS2', teamName: row[`${own}_name`],
      opponent: { id: row[`${other}_id`], name: row[`${other}_name`], slug: row[`${other}_slug`], logo: row[`${other}_logo`] },
      mapScores,
      vetoSteps: list(row.veto_steps).filter(step => step.selectedBy === (first ? 'faction1' : 'faction2') && ['Picked', 'Banned'].includes(step.action))
        .map(step => ({ map: mapName(step.map), action: step.action })),
    }];
  });
}

export async function loadTeamMapHistory(client, teamId) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('matches').select(TEAM_MAP_COLUMNS)
      .in('status', ['FINISHED', 'MATCH_STATUS_FINISHED']).or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`)
      .order('finished_at', { ascending: false, nullsFirst: false }).order('id', { ascending: true }).range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 500) break;
  }
  return normalizeTeamMapHistory(rows, teamId);
}

export function buildTeamMapStats(history, map, { now = Date.now(), days = 90, event = '', opponent = '' } = {}) {
  const name = mapName(map);
  const cutoff = days === 'all' ? -Infinity : now - Number(days) * 86400000;
  const filtered = history.filter(match => {
    const time = Date.parse(match.date);
    return Number.isFinite(time) && time >= cutoff && time <= now && (!event || match.eventId === event) && (!opponent || historyOpponentKey(match.opponent) === opponent);
  });
  const matches = filtered.flatMap(match => match.mapScores.filter(item => item.map === name).map(item => ({ ...match, ...item })))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id));
  const played = matches.length, wins = matches.filter(match => match.teamScore > match.opponentScore).length;
  const draws = matches.filter(match => match.teamScore === match.opponentScore).length;
  const roundsWon = matches.reduce((sum, match) => sum + match.teamScore, 0);
  const roundsLost = matches.reduce((sum, match) => sum + match.opponentScore, 0);
  const vetoes = filtered.filter(match => match.vetoSteps.length);
  const picks = vetoes.filter(match => match.vetoSteps.some(step => step.map === name && step.action === 'Picked')).length;
  const bans = vetoes.filter(match => match.vetoSteps.some(step => step.map === name && step.action === 'Banned')).length;
  const percent = (part, total) => total ? Math.round(part / total * 1000) / 10 : null;
  return { map: name, matches, played, wins, draws, losses: played - wins - draws, roundsWon, roundsLost, totalRounds: roundsWon + roundsLost,
    winRate: percent(wins, played), roundWinRate: percent(roundsWon, roundsWon + roundsLost),
    pickRate: percent(picks, vetoes.length), banRate: percent(bans, vetoes.length), vetoMatches: vetoes.length };
}
