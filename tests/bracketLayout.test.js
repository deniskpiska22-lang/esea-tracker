import test from "node:test";
import assert from "node:assert/strict";
import { bracketLayout, bracketWinner } from "../src/utils/bracketLayout.js";
const team = (name) => ({ name });
const match = (id, a, b, winner) => ({
  matchId: id,
  team1: team(a),
  team2: team(b),
  winner,
});
test("bye matches are reordered by actual progression rather than source order", () => {
  const rounds = [
    {
      matches: [
        match("inceptor", "INCEPTOR", "luca", 1),
        match("other", "Other", "Lost", 1),
        match("bye", "BOJONG", "bye", 1),
        match("fourth", "Fourth", "Lost2", 1),
      ],
    },
    {
      matches: [
        match("semi1", "BOJONG", "INCEPTOR", 1),
        match("semi2", "Other", "Fourth", 1),
      ],
    },
    { matches: [match("final", "BOJONG", "Other", 1)] },
  ];
  const layout = bracketLayout(rounds);
  assert.deepEqual(
    layout[0].round.matches.map((m) => m.matchId),
    ["bye", "inceptor", "other", "fourth"],
  );
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
  assert.equal(
    rounds[0].matches[0].matchId,
    "inceptor",
    "must not mutate source data",
  );
});
test("unknown teams and unrelated lower-bracket rounds produce no invented edges", () => {
  assert.deepEqual(bracketLayout(null), []);
  const layout = bracketLayout([{ matches: [{}, {}] }, { matches: [{}] }]);
  assert.deepEqual(layout[0].edges, []);
  const unrelated = bracketLayout([
    { matches: [match("a", "A", "B", 1)] },
    { matches: [match("c", "C", "D", 1)] },
  ]);
  assert.deepEqual(unrelated[0].edges, []);
});
test("a live score lead never marks a winner", () => {
  assert.equal(bracketWinner({ score1: 1, score2: 0 }), null);
  assert.equal(bracketWinner({ winner: 2, score1: 0, score2: 2 }), 2);
});
