import test from 'node:test';
import assert from 'node:assert/strict';
import { assignedCoachRows, rosterCoachAssignments } from '../server/coachAssignments.js';
import { buildCoachProfile } from '../server/coachProfile.js';

const coach = { id: '8c861233-1fb7-4966-9cdc-2b99ea7e1cea', nickname: 'Coach' };
const now = Date.parse('2026-11-17T12:00:00Z');
const period = (id, team, start, end = null) => ({ id, coach_id: coach.id, team_id: team, season: 59,
  nickname: coach.nickname, source_started_at: start, period_started_at: start, ended_at: end,
  observed_at: end || '2026-11-17T10:00:00Z', active: !end,
  team_catalog: { team: { name: team, activeSeasonParticipant: true, season: 59 } } });
const match = (id, team, date, won = true) => ({ id, status: 'FINISHED', competition_name: 'S59 EU Main',
  team1_id: team, team2_id: 'opponent', team1_name: team, team2_name: 'Opponent',
  best_of: 1, maps: ['Nuke'], team1_score: won ? 13 : 8, team2_score: won ? 8 : 13,
  started_at: date, scheduled_at: date, finished_at: date });
function profileFor(periods, matches, at = now) {
  const assignments = rosterCoachAssignments(periods, [], at);
  const rows = assignments.flatMap(assignment => assignedCoachRows(matches, assignment, coach, [], at));
  const registrations = periods.map(row => ({ person: coach, team: { id: row.team_id, name: row.team_id },
    start: row.period_started_at, end: row.ended_at, observedAt: row.observed_at, current: row.active,
    periodId: row.id, assignment: assignments.find(assignment => assignment.periodId === row.id), season: row.season }));
  return buildCoachProfile(coach.id, rows, new Map(), at, registrations);
}

test('a transfer retains career totals and freezes the old stint while tracking the new team', () => {
  const periods = [period('B-1','B','2026-11-11'), period('A-1','A','2026-11-01','2026-11-10')];
  const matches = [match('A-win','A','2026-11-02'),match('A-after','A','2026-11-12'),
    match('B-before','B','2026-11-05'),match('B-loss','B','2026-11-12',false)];
  const first = profileFor(periods,matches);
  const later = profileFor(periods,matches, now + 7 * 86400000);
  assert.equal(first.team.id, 'B');
  assert.deepEqual(first.stats.career.matches,{total:2,won:1,lost:1,drawn:0});
  assert.equal(first.stats.teams.find(row=>row.team.id==='A').matches.total,1);
  assert.equal(first.periods.find(row=>row.team.id==='A').days,later.periods.find(row=>row.team.id==='A').days);
  assert.equal(later.tenure.days,first.tenure.days+7);
  assert.equal(first.maps.won,0);
});

test('a return creates a separate zero-match current stint on the timeline', () => {
  const old = period('A-old','A','2026-11-01','2026-11-05');
  const current = { ...period('A-return','A','2026-11-15'), source_started_at:'2026-11-01', start_source:'first_observed' };
  const profile = profileFor([current,old],[match('old-win','A','2026-11-02'),match('gap','A','2026-11-10')]);
  assert.equal(profile.periods.length,2);
  assert.equal(new Set(profile.periods.map(row=>row.key)).size,2);
  assert.equal(profile.periods.find(row=>row.assignment.periodId==='A-return').matches,0);
  assert.equal(profile.tenure.days,3);
  assert.equal(profile.tenure.startSource,'first_observed');
  assert.equal(profile.stats.career.matches.total,1);
});

test('the new current team is shown even before its first match and with a stale old-team registration', () => {
  const newest = period('B-1','B','2026-11-17');
  const stale = period('A-1','A','2026-11-01');
  const profile = profileFor([newest,stale],[match('old-win','A','2026-11-10')]);
  assert.equal(profile.team.id,'B');
  assert.equal(profile.tenure.days,1);
  assert.equal(profile.assignment.periodId,'B-1');
  assert.equal(profile.stats.career.matches.total,1);
});

test('match-room history A to B to A does not draw one uninterrupted A stint', () => {
  const rows = [match('one','A','2026-11-01'),match('two','B','2026-11-05'),match('three','A','2026-11-10')]
    .map(matches => ({terminal:true,checked_at:'2026-11-17',matches,
      teams:[{id:matches.team1_id,name:matches.team1_name,coaches:[coach],roster:[]}]}));
  const profile = buildCoachProfile(coach.id,rows,new Map(),now);
  assert.equal(profile.periods.length,3);
  assert.equal(profile.periods.filter(row=>row.team.id==='A').length,2);
  assert.equal(profile.stats.career.matches.total,3);
  assert.equal(profile.stats.teams.find(row=>row.team.id==='A').matches.total,2);
});

test('a current roster does not inherit matches explicitly coached by someone else; manual assignments retain priority', () => {
  const [assignment] = rosterCoachAssignments([period('A-1','A','2026-11-01')],[],now);
  const game = match('other-coach','A','2026-11-10');
  const room = {match_id:game.id,terminal:true,checked_at:'2026-11-17',
    teams:[{id:'A',coaches:[{id:'another',nickname:'Former coach'}],roster:[]}]};
  assert.equal(assignedCoachRows([game],assignment,coach,[room],now).length,0);
  assert.equal(assignedCoachRows([game],{...assignment,source:undefined},coach,[room],now).length,1);
  const empty = {...room,teams:[{id:'A',coaches:[],roster:[]}]};
  assert.equal(assignedCoachRows([game],assignment,coach,[empty],now).length,1);
});
