import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateSeasonReport, belongsToRatingPeriod } from "../lib/seasonParticipants.js";
import { extractStandingsEntities } from "../v2/discoverStandingsEntities.js";
import { FaceitStandingsClient } from "../v2/faceitStandingsClient.js";
import { CHAMPIONSHIPS } from "../matchSyncConfig.js";

const config = JSON.parse(fs.readFileSync("scripts/v2/standings.config.json"));
const tree = JSON.parse(fs.readFileSync(config.seasonHierarchyCache)).payload;
const entities = extractStandingsEntities(tree, config);
function report() {
  return { season: 59, seasonId: config.seasonId,
    imports: entities.map((e) => ({ ...e, rows: 1, invalidRows: 0 })),
    teams: entities.map((e, i) => ({ team_id: `team-${i}`, sources: [{ region: e.region, division: e.division }] })) };
}
test("S59 has all 10 regular stages across 5 regions and 28 match championships, no Open", () => {
  assert.equal(entities.length, 10);
  assert.equal(new Set(entities.map((e) => e.region)).size, 5);
  assert.equal(CHAMPIONSHIPS.filter((c) => c.name.startsWith("S59")).length, 28);
  assert.ok(entities.every((e) => config.divisions.includes(e.division)));
});
test("complete registration report accepted, including teams with zero games", () => {
  assert.doesNotThrow(() => validateSeasonReport(report(), entities));
});
test("only explicitly reviewed empty stages with a successful registration check are allowed", () => {
  const r = report();
  r.imports[0].rows = 0;
  assert.throws(() => validateSeasonReport(r, entities));
  r.imports[0].verifiedEmpty = true;
  assert.doesNotThrow(() => validateSeasonReport(r, entities));
  const regular = entities.findIndex((e) => !e.allowVerifiedEmpty);
  r.imports[regular].rows = 0;
  r.imports[regular].verifiedEmpty = true;
  assert.throws(() => validateSeasonReport(r, entities));
});
test("empty, missing, invalid, duplicate and conflicting imports cannot activate", () => {
  for (const mutate of [
    (r) => { r.imports[0].rows=0; },
    (r) => { r.imports.pop(); },
    (r) => { r.imports[0].entityId="wrong"; },
    (r) => { r.imports[0].invalidRows=1; },
    (r) => { r.teams=[]; },
    (r) => { r.teams.push(r.teams[0]); },
    (r) => { r.teams[0].sources.push({region:"wrong",division:"Entry"}); },
  ]) { const r=report(); mutate(r); assert.throws(() => validateSeasonReport(r,entities)); }
});
test("old games never replay on S59 seed; future season does not enter S58 seed", () => {
  const s59={season:59,rating_from:"2026-10-01T20:00:00Z"};
  assert.equal(belongsToRatingPeriod({competition_name:"S58 EU Advanced",finished_at:"2026-10-06"},s59),false);
  assert.equal(belongsToRatingPeriod({competition_name:"S59 EU Main",finished_at:"2026-10-06"},s59),true);
  assert.equal(belongsToRatingPeriod({competition_name:"Cup",finished_at:"2026-09-28"},s59),false);
  assert.equal(belongsToRatingPeriod({competition_name:"Cup",finished_at:"2026-10-06"},s59),true);
  assert.equal(belongsToRatingPeriod({competition_name:"S59 EU Main"},{season:58,rating_from:null}),false);
});
test("malformed FACEIT response is not treated as a successful empty roster", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch=async () => new Response(JSON.stringify({payload:{error:"unavailable"}}));
    await assert.rejects(new FaceitStandingsClient({retries:1}).getAll(entities[0]),/malformed/);
  } finally { globalThis.fetch=original; }
});
