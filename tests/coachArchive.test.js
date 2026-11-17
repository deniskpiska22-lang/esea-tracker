import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCoachLobbies, resolvePlayerCoachId } from '../server/coachData.js';

test('coach history includes archived matches beyond the first database page', async () => {
  const archive = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const pages = [];
  const db = { from(table) {
    assert.equal(table, 'esea_coach_lobbies');
    return { select() { return this; }, overlaps() { return this; }, order(column) {
      assert.equal(column, 'match_id'); return this;
    }, async range(start, end) {
      pages.push([start, end]);
      return { data: archive.slice(start, end + 1), error: null };
    } };
  } };
  assert.deepEqual(await loadCoachLobbies(db, ['coach'], 'id'), archive);
  assert.deepEqual(pages, [[0, 499], [500, 999], [1000, 1499]]);
});

test('a former coach without a player or current roster record resolves by exact nickname', async () => {
  const db = { from() { return {
    select() { return this; }, ilike() { return this; }, eq() { return this; },
    async limit() { return { data: [], error: null }; },
    async maybeSingle() { return { data: null, error: null }; },
  }; }, async rpc() { return { data: [{ id: 'former', nickname: 'OldCoach' },
    { id: 'other', nickname: 'OldCoach2' }], error: null }; } };
  assert.equal(await resolvePlayerCoachId(db, 'oldcoach'), 'former');
});
