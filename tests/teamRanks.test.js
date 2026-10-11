import test from "node:test";
import assert from "node:assert/strict";
import { buildTeamRanks, scopeTeamRanks } from "../src/utils/teamRanks.js";

test("geographic rankings retain rating order and searches preserve local positions", () => {
  const teams = [
    { name: "America", region: "NA", country: "US", rank: 1 },
    { name: "Alpha", region: "EU", country: "DE", rank: 2 },
    { name: "Beta", region: "EU", country: "FR", rank: 3 },
    { name: "Charlie", region: "EU", country: "DE", rank: 4 },
  ];
  assert.strictEqual(scopeTeamRanks(teams), teams);
  assert.deepEqual(scopeTeamRanks(teams, "EU").map(t => t.rank), [1, 2, 3]);
  const germany = scopeTeamRanks(teams, "EU", "DE");
  assert.deepEqual(germany.map(t => [t.name, t.rank]), [["Alpha", 1], ["Charlie", 2]]);
  assert.equal(germany.filter(t => t.name === "Charlie")[0].rank, 2);
  assert.deepEqual(scopeTeamRanks(teams, "All", "DE"), germany);
  assert.deepEqual(scopeTeamRanks(teams, "NA", "DE"), []);
  assert.equal(teams[3].rank, 4);
});

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
