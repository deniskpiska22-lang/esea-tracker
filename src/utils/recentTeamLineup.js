import { normalizeTeamMapHistory } from './teamMapStats.js';

const columns = 'id,status,best_of,started_at,scheduled_at,finished_at,team1_id,team2_id,team1_score,team2_score,maps,map_scores';

export function lastFivePlayedMatches(rows, teamId, now = Date.now()) {
  const dated = rows.map(row => ({ ...row,
    finished_at: [row.finished_at, row.started_at, row.scheduled_at]
      .find(value => Date.parse(value) > Date.UTC(2000, 0)) || null,
  }));
  return normalizeTeamMapHistory(dated, teamId)
    .filter(match => Date.parse(match.date) <= now)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id)).slice(0, 5);
}

export function stableLineupPlayerIds(matches, appearances) {
  if (matches.length !== 5) return new Set();
  const byMatch = new Map(matches.map(match => [match.id, new Set()]));
  for (const row of appearances) {
    if (row.player_id) byMatch.get(row.match_id)?.add(row.player_id);
  }
  const [first, ...remaining] = [...byMatch.values()];
  return new Set([...first].filter(id => remaining.every(players => players.has(id))));
}

export async function loadLastFivePlayedMatches(client, teamId) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('matches').select(columns)
      .in('status', ['FINISHED', 'MATCH_STATUS_FINISHED']).or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`)
      .order('id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) break;
  }
  return lastFivePlayedMatches(rows, teamId);
}
