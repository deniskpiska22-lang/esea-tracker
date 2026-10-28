import test from 'node:test';
import assert from 'node:assert/strict';
import { findOneWinMatch, orientOneWinOdds } from '../src/utils/onewinMatch.js';

const match = { status: 'SCHEDULED', scheduled_at: '2026-10-29T18:00:00Z',
  team1_id: '51aa82a4-7ac4-49f2-8b88-f710dc0de1d6', team1_name: 'OldBoys',
  team2_id: '40ee7839-d6df-4086-8c8f-ca998c9aedbf', team2_name: 'Hermine Esports' };
const event = { id: 123, sportId: 142, name: 'Clutchain - Hermine', startAt: Date.parse(match.scheduled_at)/1000,
  homeTeam: {name:'Clutchain'}, awayTeam: {name:'Hermine'} };
test('OldBoys and Hermine bookmaker names match only their verified FACEIT identities', () => {
  assert.equal(findOneWinMatch(match,[event]),event);
  for (const patch of [{team1_id:'another-oldboys'},{team2_id:'another-hermine'},
    {scheduled_at:'2026-10-30T18:00:00Z'},{status:'FINISHED'}])
    assert.equal(findOneWinMatch({...match,...patch},[event]),null);
  assert.equal(findOneWinMatch(match,[event,{...event,id:124}]),null);
});
test('Clutchain prices keep the correct side when bookmaker order is reversed', () => {
  assert.deepEqual(orientOneWinOdds(match,event,{home:1.41,away:2.69}),{team1:1.41,team2:2.69});
  const reversed={...event,homeTeam:event.awayTeam,awayTeam:event.homeTeam};
  assert.equal(findOneWinMatch(match,[reversed]),reversed);
  assert.deepEqual(orientOneWinOdds(match,reversed,{home:2.69,away:1.41}),{team1:1.41,team2:2.69});
});
