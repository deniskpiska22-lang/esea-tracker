import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlayerTeam } from '../src/utils/playerTeam.js';

test('a renamed team uses its current catalogue name and keeps its ID and URL', () => {
  const id = '1791f69f-0ab1-4089-89a4-828c33667cfc';
  const old = { faceitTeamId: id, name: 'golovastiki', slug: 'golovastiki-1791f69f' };
  const current = { ...old, name: 'VP Future', logo: 'current.png' };
  const match = { teamId: id, teamName: old.name };
  assert.equal(resolvePlayerTeam([current], old, match), current);
  assert.equal(resolvePlayerTeam([{ ...current, name: 'Another rename' }], old, match).name, 'Another rename');
  assert.equal(resolvePlayerTeam([current], old, match).slug, old.slug);
});

test('an authoritative team ID never resolves to an unrelated namesake', () => {
  const roster = { faceitTeamId: 'registered', name: 'VP Future' };
  const namesake = { faceitTeamId: 'other', name: 'golovastiki' };
  assert.equal(resolvePlayerTeam([namesake], roster, { teamId: 'missing', teamName: 'golovastiki' }), roster);
  assert.equal(resolvePlayerTeam([namesake], null, { teamId: 'missing', teamName: 'golovastiki' }), null);
  assert.equal(resolvePlayerTeam([namesake], roster, null), roster);
  assert.equal(resolvePlayerTeam([], null, null), null);
});
