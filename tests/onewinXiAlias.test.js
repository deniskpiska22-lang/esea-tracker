import test from 'node:test';
import assert from 'node:assert/strict';
import { findOneWinMatch, orientOneWinOdds } from '../src/utils/onewinMatch.js';
// Observed November 1, 2026: FACEIT XI Esport–MTX, bookmaker XI–Matrix.
const match = { status: 'SCHEDULED', scheduled_at: '2026-11-01T18:00:00Z',
  team1_id: '5f2e9987-a2a3-4901-94cf-8fa9457f307b', team1_name: 'XI Esport',
  team2_id: '68c9c60e-2f40-4bae-acf3-ae4712c74734', team2_name: 'MTX' };
const event = { id: 42445001, sportId: 142, startAt: 1793556000,
  name: 'XI - Matrix', homeTeam: { name: 'XI' }, awayTeam: { name: 'Matrix' } };
test('verified XI and Matrix aliases resolve and orient the November 1 match', () => {
  assert.equal(findOneWinMatch(match, [event]), event);
  assert.deepEqual(orientOneWinOdds(match, event, { home: 1.54, away: 2.32 }), { team1: 1.54, team2: 2.32 });
  const reverse = { ...event, homeTeam: event.awayTeam, awayTeam: event.homeTeam };
  assert.equal(findOneWinMatch(match, [reverse]), reverse);
  assert.deepEqual(orientOneWinOdds(match, reverse, { home: 2.32, away: 1.54 }), { team1: 1.54, team2: 2.32 });
});
test('XI alias rejects unrelated rosters, opponents, dates and ambiguous events', () => {
  for (const patch of [{team1_id:'other-roster'}, {team1_id:undefined},
    {team2_id:'other-matrix'}, {scheduled_at:'2026-11-02T18:00:00Z'}, {status:'FINISHED'}]) {
    assert.equal(findOneWinMatch({...match,...patch},[event]), null);
  }
  assert.equal(findOneWinMatch(match,[event,{...event,id:42445002}]),null);
});
