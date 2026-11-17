import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStoredCoachLobby, storedCoachIds } from '../server/storedCoachLobby.js';
import { runCoachJobs } from '../server/coachWorkerJobs.js';
import { cacheDiscoveryCoachRoles } from '../scripts/lib/cacheDiscoveryCoachRoles.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const match={id:`1-${id(9)}`,team1_id:id(1),team2_id:id(2),status:'FINISHED',competition_name:'S58 EU Main'};
const payload=()=>({id:match.id,game:'cs2',status:'MATCH_STATUS_FINISHED',factions:[
 {id:id(10),premade_team_id:id(1),name:'A',members:[{user_id:id(3),role:'GAME_ROLE_PLAYER'},
  {user_id:id(4),role:'GAME_ROLE_SUBSTITUTE'},{user_id:id(5),role:'GAME_ROLE_COACH',participated:false}]},
 {id:id(11),premade_team_id:id(2),name:'B',members:[{user_id:id(6),role:'GAME_ROLE_PLAYER'}]},
]});
const people=new Map([[id(5),{nickname:'Coach',country:'ru'}]]);
test('stored league roles identify coaches using immutable premade IDs, not faction IDs or substitutes',()=>{
 const room=payload();
 assert.deepEqual(storedCoachIds(room),[id(5)]);
 const snapshot=parseStoredCoachLobby(room,match,people);
 assert.deepEqual(snapshot.coach_ids,[id(5)]);
 assert.deepEqual(snapshot.team_ids,[id(1),id(2)]);
 assert.equal(snapshot.teams[0].coaches[0].country,'RU');
 assert.equal(snapshot.teams[1].coaches.length,0);
 assert.equal(snapshot.terminal,true);
});
test('missing roles or mismatched room identities never certify an empty room',()=>{
 const room=payload();room.factions[1].members=[];
 assert.equal(parseStoredCoachLobby(room,match,people),null);
 room.factions[1].members=[{user_id:id(6)}];
 assert.equal(parseStoredCoachLobby(room,match,people),null);
 assert.equal(parseStoredCoachLobby(payload(),{...match,team1_id:id(99)},people),null);
 assert.equal(parseStoredCoachLobby({...payload(),id:id(50)},match,people),null);
 assert.throws(()=>parseStoredCoachLobby(payload(),match,new Map()),/Missing coach identity/);
});
test('explicit player/substitute roles produce a known empty slot without inventing a coach',()=>{
 const room=payload();room.factions[0].members=room.factions[0].members.filter(m=>m.role!=='GAME_ROLE_COACH');
 assert.deepEqual(parseStoredCoachLobby(room,match,people).coach_ids,[]);
});
test('the isolated worker retains cooldowns across restarts and one denied source does not stop other jobs',async()=>{
 let time=1000;const state={jobs:{}};const called=[];
 const jobs=[{name:'lobbies',interval:3*3600000},{name:'cached',interval:60000},{name:'rosters',interval:3*3600000}];
 const run=async job=>{called.push(job.name);if(job.name==='lobbies')throw Error('403');return{code:0};};
 const options={jobs,state,run,save:async()=>{},now:()=>time};
 await runCoachJobs(options);
 assert.deepEqual(called,['lobbies','cached','rosters']);
 assert.equal(state.jobs.lobbies.result.code,1);
 assert.equal(state.jobs.cached.result.code,0);
 time+=60001;await runCoachJobs(options);
 assert.deepEqual(called,['lobbies','cached','rosters','cached']);
});

test('ordinary discovery caches explicit roles even without a changed score and ignores Data API rosters',async()=>{
 const calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return{error:null};}};
 await cacheDiscoveryCoachRoles(db,[{...match,raw_data:payload()},
  {...match,id:'public',raw_data:{match_id:'public',teams:{faction1:{roster:[]}}}}]);
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'capture_esea_discovery_coach_roles');
 assert.deepEqual(calls[0].args.p_rows.map(r=>r.id),[match.id]);
});

test('restarting after retirement drops the old room job without disturbing pending roster refresh',async()=>{
 const state={jobs:{lobbies:{nextAt:0,running:true,result:{code:77}},rosters:{nextAt:9000}}};
 const called=[];
 await runCoachJobs({jobs:[{name:'cached',interval:60000},{name:'rosters',interval:3*3600000}],state,
  run:async job=>{called.push(job.name);return{code:0};},save:async()=>{},now:()=>1000});
 assert.deepEqual(called,['cached']);
 assert.equal(state.jobs.lobbies,undefined);
 assert.equal(state.jobs.rosters.nextAt,9000);
});
