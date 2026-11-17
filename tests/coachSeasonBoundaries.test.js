import test from 'node:test';
import assert from 'node:assert/strict';
import { coachBoundaryPlan, coachSeasonBounds } from '../server/coachSeasonBoundaries.js';
const row = (id, coaches = null) => ({ id: String(id), date: `2026-07-${String(id + 1).padStart(2, '0')}`,
  known: coaches !== null, coaches: coaches || [] });

test('first and last matches take precedence over the middle, sharing existing snapshots', () => {
  const rows = [row(0),row(1),row(2)];
  assert.equal(coachBoundaryPlan(rows, 'endpoints').index, 0);
  rows[0] = row(0, ['coach']);
  assert.equal(coachBoundaryPlan(rows, 'endpoints').index, 2);
  rows[2] = row(2, ['coach']);
  assert.equal(coachBoundaryPlan(rows, 'endpoints'), null);
  assert.equal(coachBoundaryPlan(rows), null);
  assert.equal(coachSeasonBounds({matches: rows})[0].evidence.unverifiedBetween, 1);
});
test('empty endpoints search backwards and then narrow departure to adjacent matches', () => {
  const rows = [row(0, []), row(1), row(2), row(3, [])];
  assert.equal(coachBoundaryPlan(rows).index, 2);
  rows[2] = row(2, ['coach']);
  assert.equal(coachBoundaryPlan(rows).reason, 'arrival');
  const bounds = coachSeasonBounds({team_id:'team',season:58,matches:rows})[0];
  assert.equal(bounds.evidence.last.id, '2');
  assert.equal(bounds.evidence.after.id, '3');
  assert.equal(bounds.evidence.departureAdjacent, true);
});
test('missing or deferred rooms are not treated as coach departures', () => {
  const rows = [row(0, ['coach']),row(1),row(2, [])];
  rows[1].retry_at = '2100-01-01';
  assert.equal(coachBoundaryPlan(rows), null);
  const evidence = coachSeasonBounds({matches:rows})[0].evidence;
  assert.equal(evidence.departureAdjacent, false);
  assert.equal(evidence.after.id, '2');
});
test('different coaches and a return to the same team retain gaps in the evidence', () => {
  const rows = [row(0,['A']),row(1,['B']),row(2,['A']),row(3,[])];
  const bounds = coachSeasonBounds({matches:rows});
  assert.equal(bounds.find(row => row.coach_id === 'A').evidence.hasGaps, true);
  assert.equal(bounds.find(row => row.coach_id === 'B').evidence.after.id, '2');
});

test('a coach missing at the end is searched from the penultimate match backwards', () => {
  const rows = [row(0,['A']),row(1),row(2),row(3),row(4,[])];
  assert.equal(coachBoundaryPlan(rows).index, 3);
  rows[3] = row(3,[]);
  assert.equal(coachBoundaryPlan(rows).index, 2);
  rows[2] = row(2,['A']);
  assert.equal(coachBoundaryPlan(rows), null);
  assert.equal(coachSeasonBounds({matches:rows})[0].evidence.after.id, '3');
});
