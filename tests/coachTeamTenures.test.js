import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTeamTenureCoaches } from '../server/coachTeamTenures.js';
const coach={id:'coach',nickname:'Coach'},team='team',now=Date.parse('2026-11-30T12:00:00Z');
function database(absences,{unknown=false}={}) {
  const matches=Array.from({length:absences+1},(_,i)=>({id:`match-${i}`,status:'FINISHED',competition_name:'S59 EU Main',
    team1_id:team,team2_id:'opponent',team1_score:13,team2_score:8,maps:['Nuke'],best_of:1,
    started_at:`2026-11-${String(i+1).padStart(2,'0')}T18:00:00Z`,finished_at:`2026-11-${String(i+1).padStart(2,'0')}T19:00:00Z`}));
  const rooms=matches.filter((m,i)=>!unknown||i!==3).map((match,i)=>({match_id:match.id,matches:match,terminal:true,
    checked_at:match.finished_at,coach_ids:i===0?[coach.id]:[],team_ids:[team,'opponent'],
    teams:[{id:team,name:'Team',roster:[],coaches:i===0?[coach]:[]}]}));
  const tables={matches,esea_coach_lobbies:rooms,esea_coach_roster_periods:[],esea_coach_assignment_handoffs:[],
    team_catalog:[{team_id:team,team:{name:'Team',season:59,activeSeasonParticipant:true}}]};
  return {from(name){let rows=[...(tables[name]||[])],single=false;const query={
    select(){return query;},order(){return query;},eq(key,value){rows=rows.filter(r=>r[key]===value);return query;},
    in(key,values){rows=rows.filter(r=>values.includes(r[key]));return query;},
    overlaps(key,values){rows=rows.filter(r=>r[key]?.some(v=>values.includes(v)));return query;},
    or(value){const id=value.split(',')[0].split('.').at(-1);rows=rows.filter(r=>[r.team1_id,r.team2_id].includes(id));return query;},
    range(start,end){rows=rows.slice(start,end+1);return query;},maybeSingle(){single=true;return query;},
    then(resolve,reject){return Promise.resolve({data:single?rows[0]||null:rows,error:null}).then(resolve,reject);},
  };return query;}};
}
test('team badge retains its coach through four empty slots and removes him on the fifth',async()=>{
  const four=await currentTeamTenureCoaches(database(4),team,now);
  assert.deepEqual(four.coaches.map(p=>p.id),[coach.id]);
  const five=await currentTeamTenureCoaches(database(5),team,now);
  assert.deepEqual(five.coaches,[]);
});
test('unknown room data prevents a false five-game removal from the team badge',async()=>{
  const result=await currentTeamTenureCoaches(database(7,{unknown:true}),team,now);
  assert.deepEqual(result.coaches.map(p=>p.id),[coach.id]);
});
