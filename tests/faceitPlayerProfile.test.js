import test from 'node:test';
import assert from 'node:assert/strict';
import { faceitEloPatch } from '../scripts/lib/faceitPlayerProfile.js';

test('CS2 ELO and level are saved for the exact immutable player ID', () => {
  assert.deepEqual(faceitEloPatch({ player_id: 'one', games: { cs2: { faceit_elo: 3106, skill_level: 10 } } }, 'one', 'now'),
    { faceit_profile_synced_at: 'now', faceit_elo: 3106, faceit_level: 10 });
  assert.throws(() => faceitEloPatch({ player_id: 'other' }, 'one'), /ID mismatch/);
});
test('missing CS2 data never erases known ELO or substitutes old CSGO ELO', () => {
  for (const cs2 of [undefined, {}, { faceit_elo: null, skill_level: null }, { faceit_elo: -1, skill_level: 11 }, { faceit_elo: 'bad', skill_level: 0 }]) {
    const patch = faceitEloPatch({ player_id: 'one', games: { cs2, csgo: { faceit_elo: 4000 } } }, 'one', 'now');
    assert.deepEqual({ faceit_elo: 2500, faceit_level: 10, ...patch }, { faceit_elo: 2500, faceit_level: 10, faceit_profile_synced_at: 'now' });
  }
});
