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

test('separates results by team and date, and leaves walkovers out of win rates', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const coach = assignedCoach(person.id);
  const archive = match('archive', old, 'S58 Europe Entry D', '2026-07-20T20:00:00Z');
  const win = match('win', current, 'S59 EU Entry D', '2026-11-08T20:00:00Z');
  const loss = { ...match('loss', current, 'S59 EU Entry D', '2026-11-09T20:00:00Z'),
    team1_score: 0, team2_score: 2, best_of: 3, map_scores: [
      { map: 'de_nuke', team1_score: 9, team2_score: 13 },
      { map: 'de_mirage', team1_score: 5, team2_score: 13 },
    ] };
  const walkover = { ...win, id: 'walkover', team1_score: 1, team2_score: 0 };
  const rows = [...assignedCoachRows([archive], old, coach, [], now),
    ...assignedCoachRows([win, loss, walkover], current, coach, [], now)];
  const { stats, periods } = buildCoachProfile(person.id, rows, new Map(), now);
  assert.deepEqual(stats.career.matches, { total: 3, won: 2, lost: 1, drawn: 0 });
  assert.deepEqual(stats.career.maps, { total: 4, won: 2, lost: 2, drawn: 0 });
  assert.deepEqual(stats.career.pool[0], {
    name: 'Nuke', total: 3, won: 2, lost: 1, drawn: 0, roundsWon: 35, roundsPlayed: 66,
  });
  assert.equal(stats.career.rounds.covered, 0);
  assert.deepEqual(stats.recent.matches, { total: 2, won: 1, lost: 1, drawn: 0 });
  assert.deepEqual(stats.teams.map(entry => [entry.team.id, entry.maps.total]), [[current.teamId, 3], [old.teamId, 1]]);
  assert.equal(periods[0].matches, 2);
  assert.equal(periods[0].confirmations, 3);
});

test('uses the latest played lineup for the current team when the upcoming room has none', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const coach = assignedCoach(person.id);
  const next = { ...match('next', current, 'S59 EU Entry D', '2026-11-16T19:30:00Z'),
    status: 'SCHEDULED', finished_at: null };
  const recent = match('recent', current, 'S59 EU Entry D', '2026-11-11T20:00:00Z');
  const prior = match('prior', current, 'S59 EU Entry D', '2026-11-04T20:00:00Z');
  const player = { id: 'player-one', nickname: 'PlayerOne' };
  const retiredCoach = { id: person.linkedIds[0], nickname: '-LisssTzz-' };
  const rosterRows = [
    { match_id: recent.id, teams: [{ id: current.teamId, roster: [player, retiredCoach] }] },
    { match_id: prior.id, teams: [{ id: current.teamId, roster: [{ id: 'player-two' }] }] },
  ];
  const rows = assignedCoachRows([next, recent, prior], current, coach, rosterRows, now);
  assert.deepEqual(buildCoachProfile(person.id, rows, new Map(), now).roster, [player]);
  const withoutRecent = assignedCoachRows([next, recent, prior], current, coach, rosterRows.slice(1), now);
  assert.deepEqual(buildCoachProfile(person.id, withoutRecent, new Map(), now).roster, []);
});
