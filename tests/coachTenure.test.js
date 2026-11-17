import test from 'node:test';
import assert from 'node:assert/strict';
import { rosterCoachAssignments, assignedCoachRows } from '../server/coachAssignments.js';
import { buildCoachProfile } from '../server/coachProfile.js';

const coachId = '8c861233-1fb7-4966-9cdc-2b99ea7e1cea';
const teamId = '036337bc-ab12-4ceb-83d8-fe08cebebce8';
const now = Date.parse('2026-11-17T12:00:00Z');
const registration = { coach_id: coachId, team_id: teamId, season: 59, active: true,
  nickname: 'Aler1t514', source_started_at: '2026-11-07T00:00:00Z', observed_at: '2026-11-16T20:00:00Z',
  team_catalog: { team: { activeSeasonParticipant: true, season: 59 } } };
const person = { id: coachId, nickname: 'Aler1t514' };
const game = (id, date, own, other) => ({ id, status: 'FINISHED', competition_name: 'S59 EU Entry',
  team1_id: teamId, team2_id: 'opponent', team1_name: 'Eclipse Enforcers', team2_name: 'Opponent',
  team1_score: own, team2_score: other, maps: ['Nuke'], best_of: 1,
  started_at: date, finished_at: date, scheduled_at: date });

test('counts team results since the roster join date and days through today', () => {
  const [assignment] = rosterCoachAssignments([registration], [], now);
  const matches = [game('prior', '2026-11-06', 13, 2), game('win', '2026-11-08', 13, 7),
    game('loss', '2026-11-11', 9, 13), game('award', '2026-11-12', 1, 0)];
  const rows = assignedCoachRows(matches, assignment, person, [], now);
  const profile = buildCoachProfile(coachId, rows, new Map(), now);
  assert.equal(profile.tenure.days, 11);
  assert.equal(profile.tenure.current, true);
  assert.equal(profile.tenure.source, 'league_roster');
  assert.deepEqual(profile.stats.career.matches, { total: 2, won: 1, lost: 1, drawn: 0 });
  assert.equal(profile.periods[0].winRate, 0.5);
  assert.equal(profile.periods[0].days, 11);
});

test('an ended roster period excludes games after the last confirmation and manual dates take priority', () => {
  const old = { ...registration, active: false, observed_at: '2026-11-10T00:00:00Z' };
  const [assignment] = rosterCoachAssignments([old], [], now);
  const rows = assignedCoachRows([game('inside', '2026-11-09', 13, 8), game('after', '2026-11-11', 8, 13)],
    assignment, person, [], now);
  assert.deepEqual(rows.map(row => row.matches.id), ['inside']);
  assert.equal(buildCoachProfile(coachId, rows, new Map(), now).tenure.days, 4);
  assert.deepEqual(rosterCoachAssignments([registration], [{ teamId, start: '2026-11-14', current: true }], now), []);
});
