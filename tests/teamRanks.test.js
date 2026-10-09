import test from "node:test";
import assert from "node:assert/strict";
import { buildTeamRanks } from "../src/utils/teamRanks.js";

test("search results retain their overall position, including ties", () => {
  const ranks = buildTeamRanks([
    { team_id: "c", team_name: "Charlie", points: 20 },
    { team_id: "b", team_name: "Beta", points: 100 },
    { team_id: "a", team_name: "Alpha", points: 100 },
  ], []);
  assert.equal(ranks.get("c"), 3);
  assert.equal(ranks.get("a"), 1);
  assert.equal(ranks.get("b"), 2);
});

test("unrated teams and identical names with different IDs do not get a false rank", () => {
  const ranks = buildTeamRanks([
    { team_id: "old", team_name: "Same", points: 100 },
    { team_id: "invalid", points: "invalid" },
  ], [{ faceitTeamId: "new", name: "Same" }]);
  assert.equal(ranks.has("new"), false);
  assert.equal(ranks.has("invalid"), false);
});
