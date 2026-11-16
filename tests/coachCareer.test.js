import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coachesForTeam, coachingPeriodLabel, findCoach } from '../src/utils/coachCareer.js';

test('team staff uses verified team identity and separates current and past coaches', () => {
  const entries = [
    { slug: 'active', periods: [{ teamId: 'squad-a', status: 'current' }, { teamId: 'squad-a', status: 'past' }] },
    { slug: 'former', periods: [{ teamId: 'squad-a', status: 'past' }, { teamId: 'squad-b', status: 'current' }] },
    { slug: 'unlinked', periods: [{ teamName: 'Squad A', status: 'current' }] },
  ];
  const list = coachesForTeam('squad-a', entries);
  assert.deepEqual(list.current.map(row => row.slug), ['active']);
  assert.deepEqual(list.past.map(row => row.slug), ['former']);
  assert.deepEqual(coachesForTeam(undefined, entries), { current: [], past: [] });
});

test('a season label never implies an exact date or a current assignment', () => {
  const coach = findCoach('LisssTzz');
  assert.equal(coach.periods[0].status, 'past');
  assert.equal(coachingPeriodLabel(coach.periods[0], 'en-GB'), 'ESEA Season 56 · Main Europe');
  assert.equal(coachingPeriodLabel({ from: '2025-12', to: '2026-01' }, 'en-GB'), 'Dec 2025 — Jan 2026');
});
