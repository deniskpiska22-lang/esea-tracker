import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCoachLobby } from '../server/coachLobby.js';
import { buildCoachProfile } from '../server/coachProfile.js';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const membership = n => ({ id: uuid(n), nickname: `nick${n}` });
const base = {
  id: `1-${uuid(9)}`, team1_id: uuid(1), team2_id: uuid(2), team1_name: 'A', team2_name: 'B',
  team1_score: 13, team2_score: 8, status: 'FINISHED', finished_at: '2026-11-05T19:00:00Z',
  competition_name: 'S59 EU Entry D - Regular Season', best_of: 1, maps: ['Nuke'],
};
function room({ match = base, coach = membership(5), game = 'cs2' } = {}) {
  return { id: match.id, game, status: match.status, entity: { type: 'championship', name: match.competition_name },
    teams: { faction1: { id: match.team2_id, name: 'B', roster: [membership(4)], substitutes: [membership(10)] },
      faction2: { id: match.team1_id, name: 'A', roster: [membership(3), membership(5)],
        coaches: coach ? [coach] : [] } } };
}

test('accepts only explicit coach role under the exact ESEA lobby and team IDs', () => {
  const source = room();
  const parsed = parseCoachLobby(source, base);
  assert.deepEqual(parsed.team_ids, [base.team1_id]);
  assert.deepEqual(parsed.coach_ids, [uuid(5)]);
  assert.deepEqual(parsed.teams[0].roster.map(p => p.id), [uuid(3)]);
  assert.deepEqual(parseCoachLobby(room({ coach: null }), base).teams[0].coaches, []);
  assert.equal(parseCoachLobby({ ...source, id: uuid(44) }, base), null);
  assert.equal(parseCoachLobby({ ...source, entity: { type: 'championship', name: 'CCT' } }, base), null);
  assert.equal(parseCoachLobby(source, { ...base, team1_id: uuid(77) }), null);
});

test('profile excludes maps from unconfirmed and upcoming lobbies and technical results', () => {
  const now = Date.parse('2026-11-10T14:00:00Z');
  const queued = { ...base, id: `1-${uuid(11)}`, status: 'SCHEDULED', finished_at: null, scheduled_at: '2026-11-10T20:00:00Z' };
  const wrong = { ...base, id: `1-${uuid(12)}`, team1_score: 0, team2_score: 13 };
  const award = { ...base, id: `1-${uuid(13)}`, team1_score: 1, team2_score: 0 };
  const checkedAt = new Date(now).toISOString();
  const profile = buildCoachProfile(uuid(5), [base, queued, wrong, award].map(match =>
    ({ ...parseCoachLobby(room({ match, coach: match === wrong ? membership(6) : membership(5) }), match, checkedAt), matches: match })),
  new Map(), now);
  assert.equal(profile.periods[0].matches, 2);
  assert.equal(profile.periods[0].days, 1);
  assert.equal(profile.matches[0].id, queued.id);
  assert.equal(profile.observedAt, checkedAt);
  assert.deepEqual(profile.maps, { total: 1, won: 1, best: null, worst: null });
  assert.equal(profile.rounds.ct.total, 0);
  assert.deepEqual(profile.mapHistory.map(({ id, map, ownScore }) => ({ id, map, ownScore })),
    [{ id: base.id, map: 'Nuke', ownScore: 13 }]);
});

test('keeps older recorded maps in career history without skewing current team form', () => {
  const now = Date.parse('2026-11-10T14:00:00Z');
  const old = { ...base, id: `1-${uuid(19)}`, team1_id: uuid(20), team1_name: 'Former team',
    finished_at: '2026-07-12T12:00:00Z', competition_name: 'S58 EU Entry - Regular Season',
    team1_score: 8, team2_score: 13 };
  const rows = [old, base].map(match => ({ ...parseCoachLobby(room({ match }), match), matches: match }));
  const profile = buildCoachProfile(uuid(5), rows, new Map(), now);
  assert.equal(profile.periods.length, 2);
  assert.equal(profile.maps.total, 1);
  assert.deepEqual(profile.mapHistory.map(map => map.id), [base.id, old.id]);
});
