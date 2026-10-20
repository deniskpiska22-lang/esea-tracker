import test from "node:test";
import assert from "node:assert/strict";
import { bracketLayout, bracketWinner } from "../src/utils/bracketLayout.js";
const rounds = (counts) =>
  counts.map((n) => ({ matches: Array.from({ length: n }, () => ({})) }));
test("knockout pairs connect to the correct next-round center", () => {
  const layout = bracketLayout(rounds([4, 2, 1]));
  assert.deepEqual(layout[0].centers, [64, 192, 320, 448]);
  assert.deepEqual(layout[0].edges, [
    { from: 64, to: 128 },
    { from: 192, to: 128 },
    { from: 320, to: 384 },
    { from: 448, to: 384 },
  ]);
  assert.deepEqual(layout[1].edges, [
    { from: 128, to: 256 },
    { from: 384, to: 256 },
  ]);
  assert.deepEqual(layout[2].edges, []);
});
test("lower-bracket equal-count rounds align; ambiguous progression has no invented edges", () => {
  assert.equal(bracketLayout(rounds([4, 4, 2]))[0].edges.length, 4);
  assert.equal(bracketLayout(rounds([3, 2]))[0].edges.length, 0);
  assert.deepEqual(bracketLayout(null), []);
  assert.equal(bracketLayout(rounds([0, 1])).length, 1);
});
test("a live score lead never marks a winner", () => {
  assert.equal(bracketWinner({ score1: 1, score2: 0 }), null);
  assert.equal(bracketWinner({ winner: 2, score1: 0, score2: 2 }), 2);
});
