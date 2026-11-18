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
test('an explicitly different coach slot confirms replacement without a paid league registration',()=>{
 const matches=[1,2].map(n=>game(n));
 const periods=buildCoachTenures({coachId:'old',rooms:[room(matches[0])],teamMatches:new Map([['A',matches]]),teamRooms:[room(matches[0]),room(matches[1],'new')],now});
 assert.equal(periods[0].current,false);assert.equal(periods[0].end,time(2));assert.equal(periods[0].endReason,'confirmed_replacement');
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

test('the registered coach returning to the slot closes a later temporary coach, despite an older membership date',()=>{
 const first=game(4),handoff=game(7);
 const oldRoom=room(first),newRoom=room(handoff,'registered');
 const periods=buildCoachTenures({coachId:'old',rooms:[oldRoom],teamMatches:new Map([['A',[first,handoff]]]),
   teamRooms:[{...oldRoom,matches:undefined},{...newRoom,matches:undefined}],
   teamRegistrations:[registration('registered',1)],now});
 assert.equal(periods.length,1);assert.equal(periods[0].start,time(4));
 assert.equal(periods[0].end,time(7));assert.equal(periods[0].endReason,'confirmed_replacement');
 assert.equal(periods[0].current,false);
});
test('an unknown or empty slot does not reaffirm the registered coach',()=>{
 const first=game(4),later=game(7);
 const oldRoom=room(first);
 for(const coaches of [[],undefined]) {
  const other={...room(later,'registered'),teams:[{id:'A',coaches,roster:[]}]};
  const periods=buildCoachTenures({coachId:'old',rooms:[oldRoom],teamMatches:new Map([['A',[first,later]]]),
   teamRooms:[oldRoom,other],teamRegistrations:[{...registration('registered',1),first_seen_at:time(1)}],now});
  assert.equal(periods[0].current,true);
 }
});
test('explicitly sharing a slot does not falsely remove either coach',()=>{
 const first=game(4),later=game(7);const oldRoom=room(first);
 const shared={...room(later,'registered'),teams:[{id:'A',coaches:[{id:'old'},{id:'registered'}],roster:[]}]};
 const periods=buildCoachTenures({coachId:'old',rooms:[oldRoom,shared],teamMatches:new Map([['A',[first,later]]]),
  teamRooms:[oldRoom,shared],teamRegistrations:[registration('registered',1)],now});
 assert.equal(periods[0].current,true);
});

test('a freshly confirmed official role closes an older temporary tenure even if the membership date is ancient',()=>{
 const first=game(4);const oldRoom=room(first);const reg={...registration('registered',1),first_seen_at:time(10)};
 const periods=buildCoachTenures({coachId:'old',rooms:[oldRoom],teamMatches:new Map([['A',[first]]]),teamRooms:[oldRoom],teamRegistrations:[reg],now});
 assert.equal(periods[0].end,time(10));assert.equal(periods[0].current,false);
});
test('fresh official confirmation reopens a replaced coach as a new period, not the ancient membership period',()=>{
 const first=game(1),temp=game(4);
 const periods=buildCoachTenures({coachId:'old',seeds:[{coachId:'old',teamId:'A',source:'league_roster',startSource:'league_membership',start:time(1),confirmedAt:time(10),current:true}],rooms:[room(first)],teamMatches:new Map([['A',[first,temp]]]),teamRooms:[room(first),room(temp,'temporary')],now});
 assert.equal(periods.length,2);assert.equal(periods[0].end,time(4));assert.equal(periods[1].start,time(10));assert.equal(periods[1].current,true);
 assert.notEqual(periods[0].tenureKey,periods[1].tenureKey);
});
test('role confirmation never undoes a five-game absence boundary',()=>{
 const matches=[1,2,3,4,5,6].map(n=>game(n));const rooms=matches.map((m,i)=>i===0?room(m):{...room(m),teams:[{id:'A',coaches:[],roster:[]}]});
 const periods=buildCoachTenures({coachId:'old',seeds:[{coachId:'old',teamId:'A',source:'league_roster',startSource:'league_membership',start:time(1),confirmedAt:time(10),current:true}],rooms:[rooms[0]],teamMatches:new Map([['A',matches]]),teamRooms:rooms,now});
 assert.equal(periods.length,1);assert.equal(periods[0].endReason,'five_absences');assert.equal(periods[0].current,false);
});
test('known joint staff can cover a match for each other without a false replacement',()=>{
 const first=game(1),later=game(2);
 const shared={...room(first),teams:[{id:'A',coaches:[{id:'old'},{id:'assistant'}],roster:[]}]};
 const periods=buildCoachTenures({coachId:'old',rooms:[shared],teamMatches:new Map([['A',[first,later]]]),teamRooms:[shared,room(later,'assistant')],now});
 assert.equal(periods.length,1);assert.equal(periods[0].current,true);assert.equal(periods[0].absentMatches,1);
 assert.equal('coStaffIds' in periods[0],false);
});

test('a late role checkpoint cannot pull a coach back from a confirmed transfer to another team',()=>{
 const first=game(1),replacement=game(4),transfer=game(5,'B');
 const periods=buildCoachTenures({coachId:'old',seeds:[{coachId:'old',teamId:'A',source:'league_roster',startSource:'league_membership',start:time(1),confirmedAt:time(10),current:true}],
  rooms:[room(first),room(transfer)],teamMatches:new Map([['A',[first,replacement]],['B',[transfer]]]),
  teamRooms:[room(first),room(replacement,'new'),room(transfer)],now});
 assert.equal(periods.length,2);assert.equal(periods[0].end,time(4));
 assert.equal(periods[1].teamId,'B');assert.equal(periods[1].current,true);
});
