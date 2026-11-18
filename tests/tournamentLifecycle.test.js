import test from 'node:test';
import assert from 'node:assert/strict';
import { tournamentLifecycle,tournamentRefreshDue } from '../scripts/lib/tournamentCompletion.js';
import { getTournamentStatus } from '../src/utils/tournaments.js';
import registry from '../scripts/config/trackedTournaments.json' with {type:'json'};
const now=Date.parse('2026-11-18T12:00:00Z');
const event=(life)=>({startDate:'2026-11-01',endDate:'2027-12-31',lifecycle:life});
const match=(status,date)=>({status,scheduled_at:Date.parse(date)/1000,finished_at:status==='FINISHED'?Date.parse(date)/1000:null});
test('all 28 requested championships have unique stable routes',()=>{
 assert.equal(registry.length,28);assert.equal(new Set(registry.map(e=>e.championshipId)).size,28);
 assert.equal(new Set(registry.map(e=>e.id)).size,28);
 assert.ok(registry.every(e=>/^[a-f0-9-]{36}$/.test(e.championshipId)&&e.name&&e.tier));
});
test('fresh ongoing matches and short gaps between rounds are live',()=>{
 for(const matches of [[match('ONGOING','2026-11-18T11:00:00Z')],[match('FINISHED','2026-11-18T10:00:00Z')],
  [match('SCHEDULED','2026-11-19T10:00:00Z')]]){
  const life=tournamentLifecycle({status:'ONGOING'},matches,now);
  assert.equal(getTournamentStatus(event(life),now),'live');
 }
});
test('stale source data cannot keep an event live indefinitely',()=>{
 const life=tournamentLifecycle({status:'ONGOING'},[match('ONGOING','2026-11-18T11:00:00Z')],now);
 assert.equal(getTournamentStatus(event(life),now+13*3600000),'pending');
});
test('repeated refreshes of a stuck old ONGOING match remain pending',()=>{
 const life=tournamentLifecycle({status:'ONGOING'},[match('ONGOING','2026-10-01T10:00:00Z')],now);
 assert.equal(getTournamentStatus(event(life),now),'pending');
});
test('an idle incomplete bracket is pending rather than falsely finished or live',()=>{
 const life=tournamentLifecycle({status:'ONGOING',total_rounds:8},[match('FINISHED','2026-11-10T10:00:00Z')],now);
 assert.equal(getTournamentStatus(event(life),now),'pending');
 assert.equal(getTournamentStatus(event({...life,sourceStatus:'FINISHED'}),now),'finished');
});
test('future starts stay upcoming and unknown imports stay pending',()=>{
 const life=tournamentLifecycle({status:'UPCOMING'},[],now);
 assert.equal(getTournamentStatus({...event(life),startDate:'2026-12-01'},now),'upcoming');
 assert.equal(getTournamentStatus({lifecycle:{checkedAt:null}},now),'pending');
});
test('worker never stops refreshing unfinished events because an estimated end date passed',()=>{
 assert.equal(tournamentRefreshDue({start_date:'2026-11-01',end_date:'2026-11-02'},now),true);
 assert.equal(tournamentRefreshDue({completed_at:'2026-11-01'},now),false);
 assert.equal(tournamentRefreshDue({start_date:'2026-12-20',lifecycle:{checkedAt:new Date(now-3600000).toISOString()}},now),false);
 assert.equal(tournamentRefreshDue({start_date:'2026-12-20',lifecycle:{checkedAt:new Date(now-86400001).toISOString()}},now),true);
});
test('old long-running events with recent activity retain the fast refresh interval',()=>{
 assert.equal(tournamentRefreshDue({start_date:'2026-08-01',lifecycle:{checkedAt:new Date(now-180001).toISOString(),
  lastActivityAt:now-3600000}},now),true);
});
