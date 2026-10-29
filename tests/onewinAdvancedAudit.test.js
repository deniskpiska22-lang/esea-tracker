import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findOneWinMatch, orientOneWinOdds } from '../src/utils/onewinMatch.js';
const {matches,events}=JSON.parse(readFileSync(new URL('./fixtures/onewin-advanced-oct29.json',import.meta.url)));
test('all eight tracked October 29 Advanced fixtures match their distinct real bookmaker events',()=>{
 assert.equal(matches.length,8);assert.equal(events.length,8);
 const matched=new Set();
 for(const match of matches){
  const event=findOneWinMatch(match,events);assert.ok(event,match.team1_name+' vs '+match.team2_name);
  assert.ok(!matched.has(event.id));matched.add(event.id);
  const reversed={...event,homeTeam:event.awayTeam,awayTeam:event.homeTeam};
  assert.equal(findOneWinMatch(match,[reversed]),reversed);
  const prices=orientOneWinOdds(match,event,{home:1.5,away:2.5});
  assert.deepEqual(orientOneWinOdds(match,reversed,{home:2.5,away:1.5}),prices);
  assert.equal(findOneWinMatch(match,[event,{...event,id:event.id+1000000}]),null);
 }
});
test('BERG and Inner Circle aliases do not apply to another FACEIT roster or another day',()=>{
 for(const id of ['1-7070f18e-2d18-4509-8869-db00ab965a85','1-88e52548-dd0e-466b-9725-0074673f81ff']){
  const match=matches.find(m=>m.id===id);
  assert.equal(findOneWinMatch({...match,team1_id:'unrelated',team2_id:'unrelated'},events),null);
  assert.equal(findOneWinMatch({...match,scheduled_at:'2026-10-30T18:00:00Z'},events),null);
 }
});
