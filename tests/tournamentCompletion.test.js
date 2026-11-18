import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTournamentCompletion } from '../scripts/lib/tournamentCompletion.js';
import { getTournamentStatus } from '../src/utils/tournaments.js';

const date = '2026-11-08T09:30:25.000Z';
const now = Date.parse('2026-11-16T12:00:00Z');
const finished = { status: 'FINISHED', finished_at: Date.parse(date) / 1000 };

test('FACEIT completion beats the obsolete estimated date', () => {
  const completedAt = resolveTournamentCompletion({ status: 'FINISHED' }, [finished], null, now);
  assert.equal(completedAt, date);
  assert.equal(getTournamentStatus({ startDate: '2026-11-07', endDate: '2026-11-27', completedAt }, now), 'finished');
  assert.equal(resolveTournamentCompletion(null, [], date, now), date);
});

test('a gap between rounds or a partial schedule cannot close an event', () => {
  assert.equal(resolveTournamentCompletion({ status: 'ONGOING' }, [finished], null, now), null);
  assert.equal(resolveTournamentCompletion({ status: 'FINISHED' }, [finished, { status: 'SCHEDULED' }], null, now), null);
  assert.equal(resolveTournamentCompletion({ status: 'FINISHED' }, [], null, now), new Date(now).toISOString());
  assert.equal(resolveTournamentCompletion(null, [], null, now), null);
  assert.equal(getTournamentStatus({ startDate: '2026-11-16', endDate: '2026-11-16' }, now), 'live');
  assert.equal(getTournamentStatus({ startDate: '2026-11-17', endDate: '2026-11-17' }, now), 'upcoming');
});

test('a complete declared final ends a stuck ongoing bracket, never a semifinal gap',()=>{
 const meta={status:'ONGOING',type:'bracket',total_groups:1,total_rounds:3};
 const round=n=>({...finished,round:n,results:{winner:'faction1'}});
 assert.equal(resolveTournamentCompletion(meta,[round(1),round(2)],null,now),null);
 assert.equal(resolveTournamentCompletion(meta,[round(1),round(2),round(3)],null,now),date);
 assert.equal(resolveTournamentCompletion({...meta,total_groups:2},[round(3)],null,now),null);
 assert.equal(resolveTournamentCompletion({...meta,type:'swiss'},[round(3)],null,now),null);
 assert.equal(resolveTournamentCompletion(meta,[round(3),{status:'SCHEDULED',round:2}],null,now),null);
});
test('explicit cancellation without games cannot remain live',()=>{
 const completedAt=resolveTournamentCompletion({status:'CANCELLED'},[],null,now);
 assert.equal(completedAt,new Date(now).toISOString());
 assert.equal(getTournamentStatus({startDate:'2026-12-01',lifecycle:{sourceStatus:'CANCELLED'}},now),'finished');
});
