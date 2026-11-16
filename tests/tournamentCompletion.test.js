import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTournamentCompletion } from '../scripts/lib/tournamentCompletion.js';
import { getTournamentStatus } from '../src/utils/tournaments.js';

const date = '2026-11-08T09:30:25.000Z';
const now = Date.parse('2026-11-16T12:00:00Z');
const finished = { status: 'FINISHED', finished_at: Date.parse(date) / 1000 };

test('FACEIT completion beats the obsolete estimated date', () => {
  const completedAt = resolveTournamentCompletion({ status: 'FINISHED' }, [finished], null, now);
  assert.equal(completedAt, date);
  assert.equal(getTournamentStatus({ startDate: '2026-11-07', endDate: '2026-11-27', completedAt }, now), 'finished');
  assert.equal(resolveTournamentCompletion(null, [], date, now), date);
});

test('a gap between rounds or a partial schedule cannot close an event', () => {
  assert.equal(resolveTournamentCompletion({ status: 'ONGOING' }, [finished], null, now), null);
  assert.equal(resolveTournamentCompletion({ status: 'FINISHED' }, [finished, { status: 'SCHEDULED' }], null, now), null);
  assert.equal(resolveTournamentCompletion({ status: 'FINISHED' }, [], null, now), null);
  assert.equal(getTournamentStatus({ startDate: '2026-11-16', endDate: '2026-11-16' }, now), 'live');
  assert.equal(getTournamentStatus({ startDate: '2026-11-17', endDate: '2026-11-17' }, now), 'upcoming');
});
