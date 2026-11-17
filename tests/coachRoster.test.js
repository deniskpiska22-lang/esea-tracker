import test from 'node:test';
import assert from 'node:assert/strict';
import { ESEA_LEAGUE_ID, parseLeagueCoachRoster } from '../scripts/lib/coachLeagueRoster.js';
import { buildCoachProfile } from '../server/coachProfile.js';
import { assignedCoach, coachAssignments } from '../server/coachAssignments.js';

const teamId = '036337bc-ab12-4ceb-83d8-fe08cebebce8';
const leagueTeamId = '7fd28968-fbdb-4f7e-814b-a741f2d1c594';
const coachId = '8c861233-1fb7-4966-9cdc-2b99ea7e1cea';
const expected = { team_id: teamId, team: { leagueTeamId } };
const member = { user_id: coachId, league_team_id: leagueTeamId, premade_team_id: teamId,
  game_role: 'coach', team_role: 'leader', started_at: '2026-09-25T18:00:46Z', ended_at_reason: '' };
const response = members => ({ payload: [{ team: { id: leagueTeamId, premade_team_id: teamId,
  league_id: ESEA_LEAGUE_ID }, members }] });

test('uses explicit game role with both league and premade team identities', () => {
  assert.equal(parseLeagueCoachRoster(response([member]), expected).coachId, coachId);
  assert.equal(parseLeagueCoachRoster(response([{ ...member, game_role: 'substitute' }]), expected).coachId, null);
  assert.equal(parseLeagueCoachRoster(response([{ ...member, ended_at: '2026-11-01' }]), expected).coachId, null);
  assert.equal(parseLeagueCoachRoster(response([{ ...member, ended_at_reason: 'LEFT' }]), expected).coachId, null);
  assert.equal(parseLeagueCoachRoster(response([member]), { ...expected, team: { leagueTeamId: 'other' } }), null);
  assert.throws(() => parseLeagueCoachRoster(response([{ ...member, premade_team_id: leagueTeamId }]), expected));
  assert.throws(() => parseLeagueCoachRoster(response([member, member]), expected));
});

test('a roster-only coach gets a profile with team evidence and zero unobserved matches', () => {
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

test('the owner-confirmed coaching assignment survives a FACEIT substitute role', () => {
  const owner = '0871c9f5-cacc-460e-a44a-c85bb414ad5b';
  const young = 'dcb2f3b3-72b5-4e7a-b8c5-921e1c3eeee4';
  assert.equal(assignedCoach(owner).nickname, 'LisssTzz');
  assert.ok(coachAssignments.some(item => item.coachId === owner && item.teamId === young && item.current));
});
