import test from 'node:test';
import assert from 'node:assert/strict';
import { findOneWinMatch } from '../src/utils/onewinMatch.js';

test('matches 1win Privateer only to the verified FACEIT Privateer Gaming roster', () => {
  const match = { status: 'SCHEDULED', scheduled_at: '2026-11-17T19:30:00Z', team1_name: 'Privateer Gaming',
    team1_id: '96ea5baa-61b1-444d-bf7a-99c061791c3c', team2_name: 'Spirit HU' };
  const event = { id: 43335501, sportId: 142, startAt: 1794943800,
    homeTeam: { name: 'Privateer' }, awayTeam: { name: 'Spirit HU' } };
  assert.equal(findOneWinMatch(match, [event]), event);
  assert.equal(findOneWinMatch({ ...match, team1_id: 'unrelated' }, [event]), null);
  assert.equal(findOneWinMatch({ ...match, team2_name: 'Spirit Academy' }, [event]), null);
});
