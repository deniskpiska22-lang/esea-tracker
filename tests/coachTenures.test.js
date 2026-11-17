import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoachTenures } from '../server/coachTenures.js';
import { assignedCoachRows, coachAssignments } from '../server/coachAssignments.js';
import { resolveCoachAssignments } from '../server/coachHandoff.js';
import { buildCoachProfile } from '../server/coachProfile.js';
const C='coach',A='team-A',B='team-B',now=Date.parse('2026-11-30T12:00:00Z');
const date=n=>`2026-11-${String(n).padStart(2,'0')}T18:00:00.000Z`;
const person={id:C,nickname:'Coach'};
const game=(n,team=A,changes={})=>({id:`${team}-${n}`,status:'FINISHED',team1_id:team,team2_id:'opponent',team1_name:team,
  team2_name:'Opponent',competition_name:'S59 EU Main',started_at:date(n),scheduled_at:date(n),finished_at:date(n),
  maps:['Nuke'],best_of:1,team1_score:13,team2_score:8,...changes});
const room=(match,present=false,changes={})=>({match_id:match.id,matches:match,terminal:true,checked_at:match.finished_at,
  teams:[{id:match.team1_id,coaches:present?[person]:[],roster:[]}],...changes});
function run(matches,allRooms,seeds=[],coach=person) {
  const map=new Map([...new Set(matches.map(m=>m.team1_id))].map(team=>[team,matches.filter(m=>m.team1_id===team)]));
  const own=allRooms.filter(row=>row.teams.some(side=>side.coaches?.some(p=>p.id===coach.id)));
  const periods=buildCoachTenures({coachId:coach.id,seeds,rooms:own,teamMatches:map,teamRooms:allRooms,now});
  const rows=periods.flatMap(period=>assignedCoachRows(map.get(period.teamId)||[],period,coach,allRooms,now));
  const evidence=periods.filter(period=>period.source).map(period=>({person:coach,team:{id:period.teamId,name:period.teamId},
    assignment:period,start:period.start,end:period.end,observedAt:period.observedAt,current:period.current}));
  return {periods,profile:buildCoachProfile(coach.id,rows,new Map(),now,evidence)};
}
test('one to four missed games count toward tenure wins and losses',()=>{
  const matches=Array.from({length:5},(_,i)=>game(i+1,A,i%2?{team1_score:8,team2_score:13}:{}));
  const {periods,profile}=run(matches,matches.map((m,i)=>room(m,i===0)));
  assert.equal(periods.length,1);assert.equal(periods[0].current,true);assert.equal(periods[0].absentMatches,4);
  assert.deepEqual(profile.stats.career.matches,{total:5,won:3,lost:2,drawn:0});
  assert.equal(profile.periods[0].winRate,.6);
});
test('fifth consecutive absence closes before the streak and excludes all five games',()=>{
  const matches=Array.from({length:8},(_,i)=>game(i+1));
  const {periods,profile}=run(matches,matches.map((m,i)=>room(m,i===0)));
  assert.equal(periods[0].end,date(2));assert.equal(periods[0].endExclusive,true);
  assert.equal(periods[0].current,false);assert.equal(periods[0].endReason,'five_absences');
  assert.equal(profile.stats.career.matches.total,1);
});
test('a returning coach resets the absence streak; later five absences close at their own first game',()=>{
  const matches=Array.from({length:11},(_,i)=>game(i+1));
  const {periods,profile}=run(matches,matches.map((m,i)=>room(m,i===0||i===5)));
  assert.equal(periods.length,1);assert.equal(periods[0].end,date(7));
  assert.equal(profile.stats.career.matches.total,6);
});
test('return after a closed tenure opens a distinct period and preserves earlier wins',()=>{
  const matches=Array.from({length:9},(_,i)=>game(i+1));
  const {periods,profile}=run(matches,matches.map((m,i)=>room(m,i===0||i===7)));
  assert.equal(periods.length,2);assert.notEqual(periods[0].tenureKey,periods[1].tenureKey);
  assert.equal(periods[1].start,date(8));assert.equal(periods[1].current,true);
  assert.equal(profile.stats.career.matches.total,3);
});
test('unknown, partial and failed room observations do not prove consecutive absences',()=>{
  const matches=Array.from({length:10},(_,i)=>game(i+1));
  const rooms=matches.filter(m=>m.id!==`${A}-5`).map((m,i)=>room(m,i===0));
  const result=run(matches,rooms);
  // Five complete absences after the unknown game close at game 6, not game 2.
  assert.equal(result.periods[0].end,date(6));assert.equal(result.profile.stats.career.matches.total,5);
  const partial=matches.map((m,i)=>room(m,i===0,i===5?{teams:[{id:A,roster:[]}]}:{}));
  const unclosed=run(matches,partial);
  assert.equal(unclosed.periods[0].current,true);
});
test('technical awards and canceled matches do not advance or reset the played-game streak',()=>{
  const matches=[game(1),game(2),game(3),game(4,A,{team1_score:1,team2_score:0}),
    game(5,A,{status:'CANCELLED'}),game(6),game(7),game(8)];
  const result=run(matches,matches.map((m,i)=>room(m,i===0)));
  assert.equal(result.periods[0].end,date(2));assert.equal(result.profile.stats.career.matches.total,1);
});
test('a different person in the coach slot is an absence, not an immediate termination',()=>{
  const matches=[game(1),game(2),game(3)];
  const rooms=[room(matches[0],true),room(matches[1],false,{teams:[{id:A,coaches:[{id:'substitute-coach'}]}]}),room(matches[2],true)];
  const result=run(matches,rooms);assert.equal(result.periods.length,1);assert.equal(result.profile.stats.career.matches.total,3);
});
test('room-only histories count every intervening team game, including missing room data',()=>{
  const matches=Array.from({length:12},(_,i)=>game(i+1));
  const result=run(matches,[room(matches[0],true),room(matches[11],true)]);
  assert.equal(result.periods.length,1);assert.equal(result.profile.stats.career.matches.total,12);
});
test('a positive new-team confirmation transfers the coach and a later return is separate',()=>{
  const matches=[game(1),game(2),game(3,B),game(4),game(5,B),game(6)];
  const rooms=[room(matches[0],true),room(matches[1]),room(matches[2],true),room(matches[5],true)];
  const result=run(matches,rooms);
  assert.equal(result.periods.length,3);assert.equal(result.periods[0].end,date(3));
  assert.equal(result.profile.stats.career.matches.total,5); // Old A game 4 is not his.
  assert.equal(result.profile.stats.teams.find(row=>row.team.id===B).matches.total,2);
});
test('temporary roster role changes do not split a continuous coaching tenure',()=>{
  const matches=Array.from({length:5},(_,i)=>game(i+1));
  const seeds=[{teamId:A,coachId:C,source:'league_roster',periodId:'old',start:date(1),end:date(2),current:false},
    {teamId:A,coachId:C,source:'league_roster',periodId:'new',start:date(4),current:true}];
  const result=run(matches,[room(matches[0],true),room(matches[4],true)],seeds);
  assert.equal(result.periods.length,1);assert.equal(result.profile.stats.career.matches.total,5);
});
test('owner priority remains until lobby handoff, then follows the same five-game rule',()=>{
  const manual=coachAssignments[1],coach={id:manual.coachId,nickname:'LisssTzz'};
  const matches=Array.from({length:9},(_,i)=>game(i+7,manual.teamId));
  const empty=matches.map(m=>room(m));
  const prior=run(matches,empty,[manual],coach);
  assert.equal(prior.profile.stats.career.matches.total,9);assert.equal(prior.profile.tenure.current,true);
  const first=matches[1],confirmed={...room(first),teams:[{id:manual.teamId,coaches:[coach]}]};
  const checkpoint={coach_id:coach.id,team_id:manual.teamId,started_at:manual.start,confirmed_at:date(8),handoff_at:date(8),
    confirmed_team_id:manual.teamId,confirmed_match_id:first.id};
  const seeds=resolveCoachAssignments([manual],[],[checkpoint],now,[confirmed]);
  const rooms=empty.map(r=>r.match_id===first.id?confirmed:r);
  const after=run(matches,rooms,seeds,coach);
  assert.equal(after.profile.periods.length,1);assert.equal(after.profile.periods[0].first,manual.start);
  assert.equal(after.profile.stats.career.matches.total,2);assert.equal(after.profile.tenure.current,false);
});

test('input order cannot change tenure boundaries or win rates',()=>{
  const matches=Array.from({length:10},(_,i)=>game(i+1));
  const rooms=matches.map((m,i)=>room(m,i===0||i===8));
  const first=run(matches,rooms),reordered=run([...matches].reverse(),[...rooms].reverse());
  assert.deepEqual(first.periods,reordered.periods);
  assert.deepEqual(first.profile.stats,reordered.profile.stats);
});
test('a BO3 administrative 2:0 without played maps does not advance the absence count',()=>{
  const matches=[game(1),game(2),game(3),game(4),game(5),game(6,A,{best_of:3,team1_score:2,team2_score:0,maps:[]})];
  const result=run(matches,matches.map((m,i)=>room(m,i===0)));
  assert.equal(result.periods[0].current,true);assert.equal(result.periods[0].absentMatches,4);
});

test('a roster observation between absent games does not reset the match-attendance streak',()=>{
  const matches=Array.from({length:7},(_,i)=>game(i+1));
  const seed={teamId:A,coachId:C,source:'league_roster',startSource:'first_observed',start:date(4)};
  const result=run(matches,matches.map((m,i)=>room(m,i===0)),[seed]);
  assert.equal(result.periods.length,1);assert.equal(result.periods[0].end,date(2));
  assert.equal(result.profile.stats.career.matches.total,1);
});
test('a late first-observed roster record does not reopen a period already closed by five absences',()=>{
  const matches=Array.from({length:9},(_,i)=>game(i+1));
  const seed={teamId:A,coachId:C,source:'league_roster',startSource:'first_observed',start:date(8)};
  const result=run(matches,matches.map((m,i)=>room(m,i===0)),[seed]);
  assert.equal(result.periods.length,1);assert.equal(result.profile.stats.career.matches.total,1);
});
