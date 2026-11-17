import test from 'node:test';
import assert from 'node:assert/strict';
import { coachAssignments, assignedCoach, assignedCoachRows, assignmentMatches } from '../server/coachAssignments.js';
import { resolveCoachAssignments, continueCoachHandoffRooms } from '../server/coachHandoff.js';
import { buildCoachProfile } from '../server/coachProfile.js';
const manual = coachAssignments[1], coach = assignedCoach(manual.coachId), A=manual.teamId, B='new-team';
const now=Date.parse('2026-12-20T12:00:00Z'), boundary='2026-11-20T18:00:00Z';
const checkpoint={coach_id:coach.id,team_id:A,started_at:'2026-11-07T00:00:00Z',confirmed_at:boundary,
  handoff_at:boundary,confirmed_match_id:'first-coach-room',confirmed_team_id:A};
const roster=(id,team,start,end=null)=>({id,coach_id:coach.id,team_id:team,season:59,nickname:coach.nickname,
  period_started_at:start,source_started_at:start,ended_at:end,observed_at:end||'2026-12-20T10:00:00Z',active:!end,
  team_catalog:{team:{name:team,season:59,activeSeasonParticipant:true}}});
const game=(id,team,date,won=true)=>({id,team1_id:team,team2_id:'opponent',team1_name:team,team2_name:'Opponent',
  status:'FINISHED',started_at:date,scheduled_at:date,finished_at:date,competition_name:'S59 EU Entry',
  maps:['Nuke'],team1_score:won?13:8,team2_score:won?8:13,best_of:1});
const room=match=>({match_id:match.id,matches:match,terminal:true,checked_at:match.finished_at,
  teams:[{id:match.team1_id,name:match.team1_id,roster:[],coaches:[coach]}]});
function profile(registrations,checkpoints,games,rooms=[],at=now){
  const assignments=resolveCoachAssignments([manual],registrations,checkpoints,at,rooms);
  const inferred=assignments.flatMap(assignment=>assignedCoachRows(games,assignment,coach,rooms,at));
  const covered=new Set(inferred.map(row=>`${row.matches.id}:${row.teams[0].id}`));
  const observed=rooms.filter(row=>!covered.has(`${row.matches.id}:${row.teams[0].id}`));
  const evidence=registrations.map(row=>{const assignment=assignments.find(a=>a.periodId===row.id);return {
    person:coach,team:{id:row.team_id,name:row.team_id},periodId:row.id,assignment,
    start:assignment?.start||row.period_started_at,end:assignment?.end||row.ended_at,observedAt:row.observed_at,current:assignment?.current??row.active,season:59};});
  return buildCoachProfile(coach.id,[...inferred,...continueCoachHandoffRooms(observed,assignments,coach.id,at,rooms)],new Map(),at,evidence);
}
test('subscription, roster role and missing lobby evidence leave manual priority intact',()=>{
  const reg=roster('A',A,'2026-11-15');
  for(const checkpoints of [[],[{...checkpoint,confirmed_match_id:null}], [{...checkpoint,coach_id:'other'}],
    [{...checkpoint,started_at:'2026-11-01'}],[{...checkpoint,confirmed_at:'2027-01-01'}]]) {
    const resolved=resolveCoachAssignments([manual],[reg],checkpoints,now);
    assert.equal(resolved.length,1);assert.equal(resolved[0].current,true);
  }
});
test('first lobby confirmation closes manual attribution at an exclusive boundary',()=>{
  const [closed]=resolveCoachAssignments([manual],[],[checkpoint],now);
  assert.equal(closed.current,false);
  assert.equal(assignmentMatches(closed,game('before',A,'2026-11-20T17:59:59Z')),true);
  assert.equal(assignmentMatches(closed,game('at',A,boundary)),false);
  assert.equal(assignmentMatches(closed,game('after',A,'2026-12-01')),false);
  assert.equal(coachAssignments[1].current,true); // Static owner history stays intact.
});
test('a saved checkpoint remains effective when the source room later loses its coach',()=>{
  const empty={...room(game('empty',A,'2026-12-01')),teams:[{id:A,coaches:[],roster:[]}]};
  const result=profile([], [checkpoint],[game('before',A,'2026-11-08'),game('after',A,'2026-12-01')],[empty]);
  assert.equal(result.stats.career.matches.total,1);assert.equal(result.periods[0].assignment.current,false);
});
test('same-team handoff preserves November 7 and one continuous stint, including a zero-match roster',()=>{
  const before=game('before',A,'2026-11-08');
  const reg=roster('A',A,'2026-11-15');
  const result=profile([reg],[checkpoint],[before]);
  assert.equal(result.periods.length,1);assert.equal(result.tenure.first,'2026-11-07');
  assert.equal(result.tenure.current,true);assert.equal(result.tenure.source,'league_roster');
  assert.equal(result.stats.career.matches.total,1);
});
test('automatic results, win rate and historical tenure survive a later transfer',()=>{
  const regs=[roster('B',B,'2026-12-01'),roster('A',A,'2026-11-15','2026-11-30')];
  const games=[game('manual-win',A,'2026-11-08'),game('auto-loss',A,'2026-11-21',false),
    game('old-after-transfer',A,'2026-12-05'),game('new-win',B,'2026-12-05')];
  const first=profile(regs,[checkpoint],games);
  const later=profile(regs,[checkpoint],games,[],now+86400000);
  assert.equal(first.team.id,B);assert.equal(first.periods.length,2);
  assert.deepEqual(first.stats.career.matches,{total:3,won:2,lost:1,drawn:0});
  const old=first.periods.find(p=>p.team.id===A);
  assert.equal(old.first,'2026-11-07');assert.equal(old.winRate,.5);
  assert.equal(old.days,later.periods.find(p=>p.team.id===A).days);
  assert.equal(later.tenure.days,first.tenure.days+1);
});
test('lobby-only continuation preserves history and does not count unconfirmed later games',()=>{
  const before=game('before',A,'2026-11-08'),confirmed=game('confirmed',A,boundary),unseen=game('unseen',A,'2026-12-01');
  const result=profile([],[checkpoint],[before,confirmed,unseen],[room(confirmed)]);
  assert.equal(result.periods.length,1);assert.equal(result.periods[0].first,'2026-11-07');
  assert.equal(result.stats.career.matches.total,2);
});
test('a direct move and a subsequent return never restore the manual override',()=>{
  const rooms=[room(game('first',B,boundary)),room(game('return',A,'2026-12-10'))];
  const result=profile([],[{...checkpoint,confirmed_team_id:B}],[game('old',A,'2026-11-08'),game('unseen',A,'2026-12-12')],rooms);
  assert.equal(result.team.id,A);assert.equal(result.periods.length,3);
  assert.equal(result.stats.career.matches.total,3);
  assert.equal(result.periods.filter(p=>p.team.id===A).length,2);
});
test('lobby-only A to B to A makes the return a new stint',()=>{
  const rooms=[room(game('first',A,boundary)),room(game('move',B,'2026-12-01')),room(game('return',A,'2026-12-10'))];
  const result=profile([],[checkpoint],[game('manual',A,'2026-11-08')],rooms);
  assert.equal(result.periods.length,3);assert.equal(result.stats.career.matches.total,4);
  assert.equal(result.periods.filter(p=>p.team.id===A).length,2);
});

test('a new-team coach room beats a stale old-team roster after handoff',()=>{
  const stale={...roster('A',A,'2026-11-15'),observed_at:'2026-12-01T10:00:00Z'};
  const transfer=game('move',B,'2026-12-02T18:00:00Z');
  const result=profile([stale],[checkpoint],[game('before',A,'2026-11-08'),game('not-mine',A,'2026-12-03')],[room(transfer)]);
  assert.equal(result.team.id,B);
  assert.equal(result.stats.career.matches.total,2);
  assert.equal(result.periods.find(p=>p.team.id===A).assignment.current,false);
});

test('a persisted direct-transfer checkpoint cannot revive a stale old roster if its lobby is overwritten',()=>{
  const stale={...roster('A',A,'2026-11-15'),observed_at:'2026-11-19T10:00:00Z'};
  const assignments=resolveCoachAssignments([manual],[stale],[{...checkpoint,confirmed_team_id:B}],Date.parse('2026-11-25T12:00:00Z'),[]);
  const automatic=assignments.find(row=>row.periodId==='A');
  assert.equal(automatic.current,false);assert.equal(Date.parse(automatic.end),Date.parse(boundary));
  assert.equal(assignmentMatches(automatic,game('unseen',A,'2026-12-01')),false);
});

test('covered automatic transfer games still split a later lobby-only return',()=>{
  const regs=[roster('B',B,'2026-12-01','2026-12-05')];
  const before=game('manual',A,'2026-11-08'),first=game('first',A,boundary),move=game('move',B,'2026-12-02'),back=game('back',A,'2026-12-10');
  const result=profile(regs,[checkpoint],[before,first,move,back],[room(first),room(move),room(back)]);
  assert.equal(result.periods.length,3);assert.equal(result.periods.filter(p=>p.team.id===A).length,2);
  assert.equal(result.stats.career.matches.total,4);
});
