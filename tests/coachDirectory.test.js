import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoachDirectory } from '../server/coachDirectory.js';

test('lists explicit coaches once with their latest valid team and confirmed match count', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const a = '40000000-0000-4000-8000-000000000001';
  const b = '40000000-0000-4000-8000-000000000002';
  const coach = { id: '40000000-0000-4000-8000-000000000003', nickname: 'TestCoach', avatar: 'https://example.com/a' };
  const archived = (match_id, finished_at, team) => ({
    match_id, terminal: true, matches: { status: 'FINISHED', finished_at, team1_id: a, team2_id: b },
    teams: [{ id: team, name: team === a ? 'Alpha' : 'Beta', coaches: [coach] }],
  });
  const rows = [archived('first', '2026-11-10', a), archived('latest', '2026-11-12', b), archived('latest', '2026-11-12', b),
    archived('wrong', '2026-11-15', coach.id)];
  const profile = buildCoachDirectory(rows, new Map(), now).find(entry => entry.id === coach.id);
  assert.equal(profile.team, 'Beta');
  assert.equal(profile.observedMatches, 2);
  assert.equal(profile.avatar, null);
});
