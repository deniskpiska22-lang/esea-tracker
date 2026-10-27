import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMatchTeam, matchTeamSource, normalizeFaceitFaction } from '../src/utils/matchTeamIdentity.js';
import { resolveRatingRow } from '../src/utils/resolveTeamRating.js';

const advanced = { faceitTeamId: 'a8bffebf-1a2b-4bb3-9e3c-d159960580e7', name: 'OLDBOYS', slug: 'oldboys-pl-a8bffebf', logo: 'advanced.jpg' };
const openId = 'b5a6cd54-5cec-44ff-8b00-c6adcdfffd0c';
const stored = { id: openId, name: 'OLDBOYS', slug: advanced.slug, logo: advanced.logo };
const raw = { teams: { faction1: { faction_id: advanced.faceitTeamId, name: 'OLDBOYS', avatar: 'wrong-side.jpg' }, faction2: { faction_id: openId, name: 'OldBoys', avatar: 'open10.jpg' } } };

test('Open10 OLDBOYS uses its exact faction avatar and rejects a stale Advanced profile', () => {
  const team = resolveMatchTeam([advanced], stored, raw);
  assert.equal(team.id, openId);
  assert.equal(team.logo, 'open10.jpg');
  assert.equal(team.name, 'OldBoys');
  assert.equal(team.slug, null);
  assert.equal(stored.slug, advanced.slug);
});

test('missing source data cannot resurrect a namesake crest; correct ID profiles still work', () => {
  assert.equal(resolveMatchTeam([advanced], stored).logo, null);
  const open = { faceitTeamId: openId, name: 'OldBoys', slug: 'oldboys-b5a6cd54', logo: 'open10.jpg' };
  assert.equal(resolveMatchTeam([advanced, open], stored).slug, open.slug);
  assert.equal(resolveMatchTeam([advanced, open], stored).logo, open.logo);
  assert.equal(resolveMatchTeam([advanced], { id: advanced.faceitTeamId, name: advanced.name }).logo, advanced.logo);
});

test('internal faction arrays and serialized FACEIT responses resolve by ID, not position/name', () => {
  const data = { factions: [{ premade_team_id: openId, name: 'OldBoys', avatar: 'internal.jpg' }] };
  assert.equal(resolveMatchTeam([advanced], stored, JSON.stringify(data)).logo, 'internal.jpg');
  assert.equal(resolveMatchTeam([advanced], stored, '{invalid').logo, null);
});

test('compact homepage queries retain identity-bound avatars without loading player rosters', () => {
  const row = { source_team1_id: advanced.faceitTeamId, source_team1_logo: 'advanced.jpg', source_team2_id: openId, source_team2_logo: 'open10.jpg' };
  assert.equal(resolveMatchTeam([advanced], stored, matchTeamSource(row)).logo, 'open10.jpg');
  assert.equal(matchTeamSource({ raw_data: raw }), raw);
});

test('a known team ID cannot inherit a namesake rating even with its stale slug', () => {
  const entry = { ids: [advanced.faceitTeamId], name: 'oldboys', slug: advanced.slug, row: { points: 673 } };
  assert.equal(resolveRatingRow({ ids: [openId], name: 'oldboys', slug: advanced.slug }, [entry]), null);
  assert.deepEqual(resolveRatingRow({ ids: [advanced.faceitTeamId], name: 'renamed' }, [entry]), entry.row);
  assert.deepEqual(resolveRatingRow({ name: 'oldboys' }, [entry]), entry.row);
});

test('live worker faction normalization never writes the Advanced namesake into Open10', () => {
  const faction = raw.teams.faction2;
  assert.deepEqual(normalizeFaceitFaction([advanced], faction), {
    id: openId, name: 'OldBoys', logo: 'open10.jpg', slug: null,
  });
  const matched = normalizeFaceitFaction([advanced], raw.teams.faction1);
  assert.equal(matched.slug, advanced.slug);
  assert.equal(matched.logo, 'wrong-side.jpg');
});

test('renamed teams keep fresh match names and source crests instead of the bundled catalog name', () => {
  const id = 'fe66f943-b5ab-46f6-9f43-c3ed3b9b904a';
  const catalog = [{ faceitTeamId: id, name: 'A Great Chaos', slug: 'a-great-chaos-fe66f943', logo: 'old.jpg' }];
  const team = { id, name: 'Growth Lab Esport', slug: catalog[0].slug, logo: 'current.jpg' };
  assert.equal(resolveMatchTeam(catalog, team).name, 'Growth Lab Esport');
  const compact = { source_team2_id: id, source_team2_name: 'Growth Lab Esport', source_team2_logo: 'source.jpg' };
  const resolved = resolveMatchTeam(catalog, { ...team, name: 'A Great Chaos' }, matchTeamSource(compact));
  assert.equal(resolved.name, 'Growth Lab Esport');
  assert.equal(resolved.logo, 'source.jpg');
  assert.equal(resolved.id, id);
  assert.equal(resolved.slug, catalog[0].slug);
  assert.equal(resolveMatchTeam(catalog, { id }).name, 'A Great Chaos');
});
