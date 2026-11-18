import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoachTenures } from '../server/coachTenures.js';
const time=n=>`2026-11-${String(n).padStart(2,'0')}T18:00:00.000Z`;
const now=Date.parse(time(20));
const game=(n,team='A')=>({id:`${team}-${n}`,status:'FINISHED',competition_name:'S59 EU Main',team1_id:team,team2_id:'other',team1_score:13,team2_score:8,best_of:1,maps:['Nuke'],started_at:time(n),scheduled_at:time(n),finished_at:time(n)});
const room=(match,id='old')=>({match_id:match.id,matches:match,terminal:true,checked_at:match.finished_at,teams:[{id:match.team1_id,coaches:[{id,nickname:id}],roster:[]}]});
const registration=(id,start,end=null)=>({id:`reg-${id}`,coach_id:id,team_id:'A',season:59,active:!end,period_started_at:time(start),observed_at:time(19),ended_at:end?time(end):null,start_source:'league_membership',team_catalog:{team:{season:59,activeSeasonParticipant:true}}});
function run(registrations){const matches=[1,2,3,4,5,6].map(n=>game(n));return buildCoachTenures({coachId:'old',rooms:[room(matches[0])],teamMatches:new Map([['A',matches]]),teamRooms:[room(matches[0])],teamRegistrations:registrations,now});}

test('confirmed registration replacement closes the previous tenure without five absences',()=>{
 const [period]=run([registration('new',4)]);
 assert.equal(period.end,time(4));assert.equal(period.endExclusive,true);
 assert.equal(period.current,false);assert.equal(period.endReason,'confirmed_replacement');
});
test('a confirmed historical replacement remains a boundary after the replacement has left',()=>{
 const [period]=run([registration('new',4,12)]);
 assert.equal(period.end,time(4));assert.equal(period.endReason,'confirmed_replacement');
});
test('concurrent registered coaching staff does not falsely replace either coach',()=>{
 const [period]=run([registration('old',1),registration('assistant',4)]);
 assert.equal(period.current,true);assert.equal(period.end,null);
});
test('a different coach in a room alone is not proof of a registration replacement',()=>{
 const matches=[1,2].map(n=>game(n));
 const periods=buildCoachTenures({coachId:'old',rooms:[room(matches[0])],teamMatches:new Map([['A',matches]]),teamRooms:[room(matches[0]),room(matches[1],'new')],now});
 assert.equal(periods[0].current,true);assert.equal(periods[0].absentMatches,1);
});
test('confirmed registration transfer closes the old tenure and opens the new team period',()=>{
 const first=game(1),second=game(5,'B');
 const periods=buildCoachTenures({coachId:'old',seeds:[{coachId:'old',teamId:'B',source:'league_roster',startSource:'league_membership',start:time(4),current:true}],rooms:[room(first)],teamMatches:new Map([['A',[first]],['B',[second]]]),teamRooms:[room(first)],now});
 assert.equal(periods.length,2);assert.equal(periods[0].end,time(4));
 assert.equal(periods[0].endReason,'transfer');assert.equal(periods[1].teamId,'B');
 assert.equal(periods[1].start,time(4));assert.equal(periods[1].current,true);
});
test('future registrations do not close a current tenure',()=>{
 assert.equal(run([registration('new',25)])[0].current,true);
});
