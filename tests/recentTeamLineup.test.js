import test from 'node:test';
import assert from 'node:assert/strict';
import { lastFivePlayedMatches, stableLineupPlayerIds } from '../src/utils/recentTeamLineup.js';

const team = 'team';
const played = (id, day, patch = {}) => ({ id, status: 'FINISHED', team1_id: team, team2_id: 'other',
  maps: ['Nuke'], best_of: 1, team1_score: 13, team2_score: 9,
  finished_at: `2026-11-${String(day).padStart(2, '0')}T20:00:00Z`, ...patch });

test('uses the last five played matches, excluding walkovers, future and duplicate matches', () => {
  const rows = [played('old', 1), played('one', 2), played('two', 3), played('three', 4), played('four', 5),
    played('five', 6), played('five', 6), played('award', 7, { team1_score: 1, team2_score: 0 }),
    played('next', 8, { status: 'SCHEDULED' })];
  assert.deepEqual(lastFivePlayedMatches(rows, team, Date.parse('2026-11-17')).map(match => match.id),
    ['five', 'four', 'three', 'two', 'one']);
});

test('a changing fifth player stays unconfirmed, including when the newest lineup is incomplete', () => {
  const matches = [1, 2, 3, 4, 5].map(id => ({ id: String(id) }));
  const rows = matches.flatMap(match => ['a', 'b', 'c', 'd', match.id === '1' ? 'new' : 'old']
    .map(player_id => ({ match_id: match.id, player_id })));
  assert.deepEqual([...stableLineupPlayerIds(matches, rows)], ['a', 'b', 'c', 'd']);
  assert.equal(stableLineupPlayerIds(matches, rows.filter(row => row.match_id !== '1')).size, 0);
  assert.equal(stableLineupPlayerIds(matches.slice(0, 4), rows).size, 0);
});
