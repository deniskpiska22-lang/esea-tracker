import test from 'node:test';
import assert from 'node:assert/strict';
import { coachAssignments, assignmentMatches, assignedCoach, assignedCoachRows } from '../server/coachAssignments.js';
import { buildCoachProfile } from '../server/coachProfile.js';
import { mergePeopleSearch } from '../src/utils/siteSearch.js';
import { linkedPlayerProfile } from '../src/data/linkedPlayerProfiles.js';

const person = linkedPlayerProfile('-LisssTzz-');
const [old, current] = coachAssignments;
const match = (id, assignment, competition_name, date) => ({
  id, status: 'FINISHED', competition_name, scheduled_at: date,
  finished_at: date, team1_id: assignment.teamId, team1_name: 'Team',
  team2_id: 'opponent', team2_name: 'Opponent', team1_score: 13, team2_score: 9, maps: ['Nuke'],
});

test('links the retired FACEIT identity and shows one result for either nickname', () => {
  assert.equal(linkedPlayerProfile(person.linkedIds[0]).id, person.id);
  const result = mergePeopleSearch([
    { faceit_id: person.id, nickname: person.nickname },
    { faceit_id: person.linkedIds[0], nickname: '-LisssTzz-' },
  ], [{ id: person.id, nickname: person.nickname, playerNickname: person.nickname }], 'lisss');
  assert.equal(result.length, 1);
  assert.equal(result[0].faceit_id, person.id);
});

test('limits past tenure to Season 58 and current tenure to games from November 7 onward', () => {
  const archive = match('archive', old, 'S58 Europe Entry D - Playoffs', '2026-09-14T18:18:37Z');
  const newer = match('new', old, 'S59 EU Intermediate A - Regular Season', '2026-11-07T19:30:00Z');
  const prior = { ...match('prior', current, 'S59 EU Entry D', '2026-11-07T01:30:00Z'), started_at: '2026-11-06T23:30:00Z' };
  const after = match('after', current, 'S59 EU Entry D', '2026-11-07T19:30:00Z');
  assert.equal(assignmentMatches(old, newer), false);
  assert.equal(assignmentMatches(current, prior), false);
  const now = Date.parse('2026-11-16T12:00:00Z');
  const coach = assignedCoach(person.id);
  const rows = [...assignedCoachRows([archive, newer], old, coach, [], now), ...assignedCoachRows([prior, after, after], current, coach, [], now)];
  const profile = buildCoachProfile(person.id, rows, new Map(), now);
  assert.equal(profile.team.id, current.teamId);
  assert.equal(profile.periods[0].first, '2026-11-07');
  assert.equal(profile.periods[1].season, 58);
  assert.deepEqual(profile.periods.map(p => [p.matches, p.mapTotals.played]), [[1, 1], [1, 1]]);
});
