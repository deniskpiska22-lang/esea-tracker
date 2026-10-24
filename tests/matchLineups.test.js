import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from './fixtures/partialMatchLineups.json' with { type: 'json' };
import { readMatchLineup, resolveMatchLineup, formatLineupStat } from '../src/utils/matchLineups.js';
import { getPlayerId } from '../src/utils/playerIdentity.js';

const player = (id, extras = {}) => ({ faceit_id: id, nickname: id, ...extras });
const roster = (starting = [], bench = [], extras = {}) => ({
  loading: false, error: null, starting, bench, former: [], ...extras,
});

test('the reported FACEIT match really contains four and two named starters with substitutes', () => {
  assert.equal(readMatchLineup(fixture, fixture.teams.faction1.faction_id).matchRoster.length, 4);
  assert.equal(readMatchLineup(fixture, fixture.teams.faction2.faction_id).matchRoster.length, 2);
  assert.equal(readMatchLineup(fixture, fixture.teams.faction2.faction_id).matchSubstitutes.length, 3);
});

test('TrafficPills keeps all four named players and adds a clearly estimated fifth from this match', () => {
  const team = readMatchLineup(fixture, fixture.teams.faction1.faction_id);
  const current = roster([...team.matchRoster, team.matchSubstitutes[1]], [team.matchSubstitutes[0]]);
  const result = resolveMatchLineup(team, current);
  assert.equal(result.starting.length, 5);
  assert.deepEqual(result.starting.slice(0, 4).map(getPlayerId), team.matchRoster.map(getPlayerId));
  assert.equal(result.starting[4].nickname, 'Minor');
  assert.equal(result.inferredCount, 1);
  assert.equal(result.starting[4].lineupInferred, true);
  assert.equal(result.announcedCount, 4);
  assert.equal(result.provisional, true);
});

test('k1LL3RZ keeps both named starters and includes all three match substitutes as estimates', () => {
  const team = readMatchLineup(fixture, fixture.teams.faction2.faction_id);
  const current = roster([...team.matchRoster, ...team.matchSubstitutes]);
  const result = resolveMatchLineup(team, current);
  assert.equal(result.starting.length, 5);
  assert.equal(result.announcedCount, 2);
  assert.equal(result.inferredCount, 3);
  assert.deepEqual(result.starting.slice(2).map(p => p.nickname), ['SEXYVLAD1K', 'for7una-', 'Mouread']);
});

test('a complete FACEIT selection stays authoritative even when a listed player has left the current team', () => {
  const selected = ['a', 'b', 'c', 'd', 'e'].map(id => player(id));
  const result = resolveMatchLineup({ matchRoster: selected }, roster([player('other')], [], {
    former: [player('e', { rating: 1.24, country: 'DE', isActive: false })],
  }));
  assert.deepEqual(result.starting.map(getPlayerId), selected.map(getPlayerId));
  assert.equal(result.starting[4].rating, 1.24);
  assert.equal(result.starting[4].country, 'DE');
  assert.equal(result.provisional, false);
  assert.equal(result.inferredCount, 0);
  assert.equal(result.lineupSource, 'match_roster');
});

test('only declared match substitutes fill gaps when that candidate list is available', () => {
  const result = resolveMatchLineup({ matchRoster: [player('a')], matchSubstitutes: [player('b')] },
    roster(['a', 'b', 'coach', 'other-team-player', 'old-member'].map(id => player(id))));
  assert.deepEqual(result.starting.map(getPlayerId), ['a', 'b']);
});

test('without match substitutes, current active players fill gaps without duplicates or former players', () => {
  const result = resolveMatchLineup({ matchRoster: [player('a'), player('a')] },
    roster([player('a'), player('b'), player('c', { isActive: false })], [player('d')], { former: [player('former')] }));
  assert.deepEqual(result.starting.map(getPlayerId), ['a', 'b', 'd']);
  assert.equal(result.inferredCount, 2);
});

test('a missing match selection remains a likely team lineup rather than a confirmed five', () => {
  const result = resolveMatchLineup({}, roster(['a', 'b', 'c', 'd', 'e'].map(id => player(id))));
  assert.equal(result.starting.length, 5);
  assert.equal(result.inferredCount, 5);
  assert.equal(result.announcedCount, 0);
  assert.equal(result.provisional, true);
});

test('incomplete data stays incomplete so the UI can show unknown slots rather than invented players', () => {
  const result = resolveMatchLineup({ matchRoster: [player('a'), player('b')] }, roster());
  assert.equal(result.starting.length, 2);
  assert.equal(result.inferredCount, 0);
  assert.equal(result.pendingPlayers, false);
  assert.ok(result.provisional);
});

test('partial match players remain visible while registered player details are loading', () => {
  const result = resolveMatchLineup({ matchRoster: [player('a'), player('b')] }, roster([], [], { loading: true }));
  assert.equal(result.loading, false);
  assert.equal(result.pendingPlayers, true);
  assert.equal(result.starting.length, 2);
  const full = resolveMatchLineup({ matchRoster: ['a', 'b', 'c', 'd', 'e'].map(id => player(id)) }, roster([], [], { loading: true }));
  assert.equal(full.loading, false);
  assert.equal(full.pendingPlayers, false);
});

test('lineups cannot leak across similarly named teams or faction positions', () => {
  const raw = { teams: { faction2: { faction_id: 'correct', name: 'Same Name', roster: [player('right')] }, faction1: { faction_id: 'wrong', name: 'Same Name', roster: [player('wrong')] } } };
  assert.deepEqual(readMatchLineup(JSON.stringify(raw), 'correct').matchRoster.map(getPlayerId), ['right']);
  assert.deepEqual(readMatchLineup(raw, 'missing').matchRoster, []);
  assert.deepEqual(readMatchLineup('{invalid', 'correct').matchRoster, []);
});

test('duplicate or invalid FACEIT entries do not consume two slots or fabricate an identity', () => {
  const raw = { teams: { faction1: { faction_id: 'a', roster: [player('one'), player('one'), {}, null] } } };
  assert.deepEqual(readMatchLineup(raw, 'a').matchRoster.map(getPlayerId), ['one']);
});

test('an oversized registration roster is capped and never presented as a settled starting five', () => {
  const result = resolveMatchLineup({ matchRoster: ['a', 'b', 'c', 'd', 'e', 'f'].map(id => player(id)) }, roster());
  assert.equal(result.starting.length, 5);
  assert.equal(result.provisional, true);
  assert.equal(result.inferredCount, 5);
});

test('FACEIT completing its selection replaces estimated players and updates the source label', () => {
  const current = roster(['a', 'b', 'c', 'd', 'e'].map(id => player(id)));
  assert.equal(resolveMatchLineup({ matchRoster: [player('a')] }, current).inferredCount, 4);
  const updated = resolveMatchLineup({ matchRoster: ['a', 'v', 'w', 'x', 'y'].map(id => player(id)) }, current);
  assert.deepEqual(updated.starting.map(getPlayerId), ['a', 'v', 'w', 'x', 'y']);
  assert.equal(updated.inferredCount, 0);
});

test('missing comparison stats show a dash rather than a fabricated zero', () => {
  for (const value of [undefined, null, '', 'invalid']) assert.equal(formatLineupStat(value, 2), '—');
  assert.equal(formatLineupStat(0, 2), '0.00');
  assert.equal(formatLineupStat(1.27, 2), '1.27');
});
