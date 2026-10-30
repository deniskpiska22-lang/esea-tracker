import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findOneWinMatch, orientOneWinOdds, buildOneWinMatchUrl } from '../src/utils/onewinMatch.js';
const {matches,events}=JSON.parse(readFileSync(new URL('./fixtures/onewin-advanced-oct30.json',import.meta.url)));
test('all three October 30 Advanced fixtures resolve to distinct observed bookmaker events',()=>{
  const ids=new Set();
  for(const match of matches){
    const event=findOneWinMatch(match,events);
    assert.ok(event,`${match.team1_name} vs ${match.team2_name}`);
    assert.ok(!ids.has(event.id));ids.add(event.id);
    assert.equal(findOneWinMatch(match,[event,{...event,id:event.id+1000000}]),null);
    const reversed={...event,homeTeam:event.awayTeam,awayTeam:event.homeTeam};
    assert.equal(findOneWinMatch(match,[reversed]),reversed);
    assert.deepEqual(orientOneWinOdds(match,reversed,{home:2.5,away:1.5}),orientOneWinOdds(match,event,{home:1.5,away:2.5}));
    const target=new URL(buildOneWinMatchUrl(event));
    assert.equal(target.searchParams.get('p'),'g39d');
    assert.ok(target.pathname.endsWith(`-${event.id}`));
  }
});
test('Matrix alias is restricted to the verified MTX roster and correct time and opponent',()=>{
  const match=matches.find(m=>m.team1_name==='MTX');
  const event=events.find(e=>e.id===42330720);
  for(const patch of [{team1_id:'another-roster'},{team2_name:'Fortress Academy'},
    {scheduled_at:'2026-10-31T19:30:00Z'},{status:'FINISHED'}]){
    assert.equal(findOneWinMatch({...match,...patch},[event]),null);
  }
});
