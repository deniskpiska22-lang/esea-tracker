import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlayerTeamHistory,careerAxis} from '../src/utils/playerTeamHistory.js';
const catalog=[{faceitTeamId:'a',name:'Renamed A',slug:'a'},{faceitTeamId:'b',name:'B',slug:'b'}];
const match=(id,teamId,date,extra={})=>({matchId:id,teamId,teamName:teamId,date,teamScore:13,opponent:{score:8},rating:1.1,...extra});
test('renames keep one period by ID, return to a team creates a new period',()=>{
 const h=buildPlayerTeamHistory([match('4','a','2026-03-01'),match('1','a','2026-01-01'),match('2','a','2026-01-05',{teamName:'Old A'}),match('3','b','2026-02-01')],catalog);
 assert.equal(h.teamCount,2);assert.equal(h.periods.length,3);assert.equal(h.periods[0].name,'Renamed A');assert.equal(h.latest.days,1);assert.equal(h.latest.end,Date.parse('2026-03-01'));assert.equal(h.periods[0].count,2);
});
test('deduplicates matches, excludes undated entries and avoids namesake ID substitution',()=>{
 const a=match('1','unlisted','2026-01-01',{teamName:'B'});
 const h=buildPlayerTeamHistory([a,a,match('2','a',null),match('3','a','bad')],catalog);
 assert.equal(h.matchCount,1);assert.equal(h.latest.team,null);assert.equal(h.latest.identity,'id:unlisted');
});
test('win rate counts decided series, unknown metrics remain unknown',()=>{
 const h=buildPlayerTeamHistory([match('1','a','2026-01-01',{rating:null}),match('2','a','2026-01-02',{teamScore:0,opponent:{score:0},rating:0}),match('3','a','2026-01-03',{teamScore:8,opponent:{score:13},rating:1.3})],catalog);
 assert.equal(h.latest.winRate,50);assert.equal(h.latest.rating,1.3);assert.equal(h.latest.adr,null);assert.equal(h.latest.count,3);
});
test('single match and year boundaries have finite axis, inclusive observation days',()=>{
 const h=buildPlayerTeamHistory([match('1','a','2025-12-31T23:59:00Z'),match('2','a','2026-01-01T00:01:00Z')],catalog);
 assert.equal(h.latest.days,2);const axis=careerAxis(h.last,h.last);assert.ok(axis.max>axis.min);assert.equal(axis.ticks.length,4);
 assert.deepEqual(buildPlayerTeamHistory([],catalog).periods,[]);
});

test('Jumbo qualifier roster shares one consecutive career period and the main team link', () => {
  const main = '934a2bd0-fa66-4c02-ac92-00f742e7ec55';
  const qualifier = 'b0fcb32f-15fd-4063-b0e9-4412046bed56';
  const team = { faceitTeamId: main, name: 'Jumbo team', slug: 'jumbo-team' };
  const career = buildPlayerTeamHistory([
    match('1', main, '2026-07-31'),
    match('2', qualifier, '2026-11-08', { teamName: 'JUMBO', teamScore: 9, opponent: { score: 13 } }),
    match('3', main, '2026-11-10'),
  ], [team]);
  assert.equal(career.periods.length, 1);
  assert.equal(career.latest.team, team);
  assert.equal(career.latest.name, 'Jumbo team');
  assert.equal(career.latest.count, 3);
  assert.equal(career.teamCount, 1);
  assert.equal(career.latest.matches[1].teamId, qualifier);
});
