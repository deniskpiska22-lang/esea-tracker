import test from 'node:test';
import assert from 'node:assert/strict';
import { findOneWinMatch, orientOneWinOdds } from '../src/utils/onewinMatch.js';
// Public November 2 feed: Al Ahli - Fortress, event 42504817 at 19:00 UTC.
const match = { status: 'SCHEDULED', scheduled_at: '2026-11-02T19:00:00Z',
 team1_id:'5b1be77d-1cbe-4efd-981f-cda176c24061',team1_name:'Al Ahli Esports',
 team2_id:'80473369-d322-499b-acfc-a8464edd132e',team2_name:'Fortress' };
const event = {id:42504817,sportId:142,startAt:Date.parse(match.scheduled_at)/1000,
 name:'Al Ahli - Fortress',homeTeam:{name:'Al Ahli'},awayTeam:{name:'Fortress'}};
test('Al Ahli abbreviation belongs only to the verified FACEIT roster, in either order',()=>{
 assert.equal(findOneWinMatch(match,[event]),event);
 assert.deepEqual(orientOneWinOdds(match,event,{home:1.37,away:2.84}),{team1:1.37,team2:2.84});
 const reverse={...event,homeTeam:event.awayTeam,awayTeam:event.homeTeam};
 assert.equal(findOneWinMatch(match,[reverse]),reverse);
 assert.deepEqual(orientOneWinOdds(match,reverse,{home:2.84,away:1.37}),{team1:1.37,team2:2.84});
});
test('alias rejects namesakes, different opponents, old events and ambiguity',()=>{
 for(const patch of [{team1_id:'other-roster'},{team1_id:undefined},{team2_name:'Other Fortress'},{status:'FINISHED'},{scheduled_at:'2026-11-03T19:00:00Z'}]) assert.equal(findOneWinMatch({...match,...patch},[event]),null);
 assert.equal(findOneWinMatch(match,[event,{...event,id:2}]),null);
});
