import assert from 'node:assert/strict';
import { test } from 'node:test';
import teams from '../src/data/teams.generated.js';
import { findCatalogTeam } from '../src/utils/teamIdentity.js';

const entry = {
  faceitTeamId: '4c564484-363c-4147-b599-15f0dc538616',
  name: 'Nexora', slug: 'nexora-4c564484', logo: 'entry-logo', division: 'Entry',
};

test('Nexora vs Adepts: stale catalog cannot substitute Advanced Nexora', () => {
  assert.equal(findCatalogTeam(teams, entry.faceitTeamId, entry.name), null);
  assert.equal(findCatalogTeam([...teams, entry], entry.faceitTeamId, entry.name), entry);
  assert.equal(findCatalogTeam(teams, '33255748-269c-4731-bfab-dffeaca491f2', 'Nexora').division, 'Advanced');
});

test('name-only lookup accepts only a unique team', () => {
  assert.equal(findCatalogTeam(teams, null, 'Nexora'), null);
  assert.equal(findCatalogTeam([entry], null, ' NEXORA '), entry);
  assert.equal(findCatalogTeam([entry], 'different-id', 'Nexora'), null);
  assert.equal(findCatalogTeam([entry], null, ''), null);
});
