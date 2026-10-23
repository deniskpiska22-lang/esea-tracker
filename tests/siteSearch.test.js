import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerSearchIndex, searchPlayers } from '../src/utils/siteSearch.js';
import { findTeamByRoute } from '../src/utils/teamProfileUrls.js';

test('indexed player search preserves FACEIT identities and live results take precedence', () => {
  const index = buildPlayerSearchIndex([{ name: 'Team A', players: ['Player'], playerIds: ['static-id'] }], [{ nickname: 'PLAYER', rating: 1.2 }, { nickname: 'Player2', team: 'B' }]);
  assert.equal(index.length, 2);
  assert.equal(searchPlayers(index, [], 'play')[0].faceit_id, 'static-id');
  const live = { nickname: 'PLAYER', faceit_id: 'live-id', query: 'play' };
  const results = searchPlayers(index, [live], 'play');
  assert.equal(results[0], live); assert.equal(results.length, 2);
  assert.equal(searchPlayers(index, [{ ...live, query: 'old-query' }], 'play')[0].faceit_id, 'static-id');
  assert.deepEqual(searchPlayers(index, [live], ''), []);
});

test('search stops at the result limit without scanning the rest of the archive', () => {
  const index = Array.from({ length: 6 }, (_, i) => ({ nickname: `player${i}`, searchKey: `player${i}` }));
  index.push({ get searchKey() { throw new Error('Unnecessary full scan'); } });
  assert.equal(searchPlayers(index, [], 'player').length, 6);
});

test('team lookup index preserves ID/canonical/alias precedence and refreshes with catalog versions', () => {
  const a = { faceitTeamId: 'a', slug: 'old', profileSlug: 'alpha', urlAliases: ['same'] };
  const b = { faceitTeamId: 'b', slug: 'same', profileSlug: 'old', urlAliases: [] };
  const catalog = [a, b];
  assert.equal(findTeamByRoute(catalog, 'old'), b);
  assert.equal(findTeamByRoute(catalog, 'same'), a);
  assert.equal(findTeamByRoute(catalog, 'a'), a);
  const updated = [{ ...a, profileSlug: 'renamed' }, b];
  assert.equal(findTeamByRoute(updated, 'renamed').faceitTeamId, 'a');
  assert.equal(findTeamByRoute(updated, 'alpha'), null);
});
