import test from 'node:test';
import assert from 'node:assert/strict';
import { coachNicknameFromRoster } from '../scripts/lib/faceitCoachRoster.js';
import { buildCoachProfile } from '../server/coachProfile.js';

const teamId = '036337bc-ab12-4ceb-83d8-fe08cebebce8';
const coachId = '8c861233-1fb7-4966-9cdc-2b99ea7e1cea';
function ax(nodeId, parentId, role, name, childIds = [], url) {
  return { nodeId, parentId, role: { value: role }, name: { value: name }, childIds,
    properties: url ? [{ name: 'url', value: { value: url } }] : [] };
}
const page = [
  ax('root', undefined, 'generic', '', ['header', 'roster', 'results']),
  ax('header', 'root', 'heading', 'Active League Roster'),
  ax('roster', 'root', 'generic', '', ['team', 'player', 'subs', 'label', 'coach']),
  ax('team', 'roster', 'link', 'Eclipse Enforcers', [], `https://www.faceit.com/en/teams/${teamId}/leagues`),
  ax('player', 'roster', 'button', 'Kovvat'),
  ax('subs', 'roster', 'StaticText', 'Substitutes Optional'),
  ax('label', 'roster', 'StaticText', 'Coach Optional'),
  ax('coach', 'roster', 'button', 'Aler1t514'),
  ax('results', 'root', 'generic', '', ['records', 'season', 'region']),
  ax('records', 'results', 'heading', 'Season Records'),
  ax('season', 'results', 'button', 'Season 59'),
  ax('region', 'results', 'link', 'REGION Europe', [], 'https://www.faceit.com/en/cs2/league/ESEA%20League/a14b8616/season'),
];

test('reads the explicit coach slot for the matching ESEA team and season', () => {
  assert.equal(coachNicknameFromRoster(page, teamId, 59), 'Aler1t514');
  assert.equal(coachNicknameFromRoster(page, teamId, 58), null);
  assert.equal(coachNicknameFromRoster(page, coachId, 59), null);
  assert.equal(coachNicknameFromRoster(page.filter(node => node.nodeId !== 'coach'), teamId, 59), null);
  assert.equal(coachNicknameFromRoster(page.filter(node => node.nodeId !== 'label'), teamId, 59), null);
});

test('a roster confirmation opens a coach profile without inventing matches, results or dates', () => {
  const now = Date.parse('2026-11-17T14:00:00Z');
  const observedAt = '2026-11-17T13:00:00Z';
  const team = { id: teamId, name: 'Eclipse Enforcers', slug: 'eclipse-enforcers' };
  const person = { id: coachId, nickname: 'Aler1t514' };
  const profile = buildCoachProfile(coachId, [], new Map(), now, [{ person, team, season: 59, observedAt, current: true }]);
  assert.equal(profile.nickname, person.nickname);
  assert.equal(profile.team, team);
  assert.equal(profile.observedAt, observedAt);
  assert.equal(profile.registered, true);
  assert.equal(profile.stats.career.matches.total, 0);
  assert.deepEqual(profile.matches, []);
  assert.deepEqual(profile.periods, []);
  assert.equal(profile.registeredTeams[0].season, 59);
});
