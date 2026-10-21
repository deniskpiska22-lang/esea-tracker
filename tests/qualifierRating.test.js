import test from "node:test";
import assert from "node:assert/strict";
import { isUnplayedQualifierResult } from "../scripts/lib/qualifierRating.js";

const qualifier = {
  status: "FINISHED", competition_name: "CCT 2026 Contenders Europe 10 - Open Qualifier 1",
  best_of: 1, team1_score: 1, team2_score: 0, map_scores: [],
};
const playedMap = (first = 13, second = 9) => ({ team1_score: first, team2_score: second });

test("Nemesis automatic loss and technical win have no rating eligibility", () => {
  assert.equal(isUnplayedQualifierResult({ ...qualifier,
    id: "1-a78bbc96-0fc1-406b-b304-a899e3f1d450", started_at: null,
    rating_details: [{ factions: { faction1: { score: 1 }, faction2: { score: 0 } } }],
  }), true);
  assert.equal(isUnplayedQualifierResult({ ...qualifier,
    id: "1-180873db-bf3a-4263-a535-87a168d55b44", started_at: "2026-10-17T15:40:25Z",
  }), true);
  assert.equal(isUnplayedQualifierResult({ ...qualifier, team1_score: 0, team2_score: 1 }), true);
});

test("a BO1 series score of 1:0 with played map rounds stays eligible", () => {
  assert.equal(isUnplayedQualifierResult({ ...qualifier, map_scores: [playedMap()] }), false);
  assert.equal(isUnplayedQualifierResult({ ...qualifier,
    rating_details: [{ factions: { faction1: { score: 13 }, faction2: { score: 0 } } }],
  }), false);
  assert.equal(isUnplayedQualifierResult({ ...qualifier, raw_data: {
    detailed_results: [{ factions: { faction1: { score: 16 }, faction2: { score: 14 } } }],
  } }), false);
});

test("played qualifier matches, including 13:0 and missing statistics, keep counting", () => {
  for (const [first, second] of [[13, 0], [0, 13], [13, 11], [5, 13], [16, 14]]) {
    assert.equal(isUnplayedQualifierResult({ ...qualifier,
      team1_score: first, team2_score: second, map_scores: null,
    }), false);
  }
  assert.equal(isUnplayedQualifierResult({ ...qualifier, best_of: 3, team1_score: 2,
    map_scores: [playedMap(), playedMap(13, 0)],
  }), false);
  assert.equal(isUnplayedQualifierResult({ ...qualifier, best_of: 3, team1_score: 2 }), false);
});

test("technical results in longer series and Finnish qualifiers are excluded", () => {
  assert.equal(isUnplayedQualifierResult({ ...qualifier, best_of: 3, map_scores: [playedMap()] }), true);
  assert.equal(isUnplayedQualifierResult({ ...qualifier, best_of: 5 }), true);
  assert.equal(isUnplayedQualifierResult({ ...qualifier, best_of: 3, team1_score: 2,
    map_scores: [playedMap(), playedMap(1, 0)],
  }), true);
  assert.equal(isUnplayedQualifierResult({ ...qualifier, competition_name: "Elisa Open Suomi 14 | Avoin karsinta 2" }), true);
});

test("league policy, ongoing games and invalid scores are unaffected", () => {
  assert.equal(isUnplayedQualifierResult({ ...qualifier, best_of: 3, competition_name: "ESEA S59 Main" }), false);
  assert.equal(isUnplayedQualifierResult({ ...qualifier, status: "ONGOING" }), false);
  for (const score of [null, undefined, "invalid", 0]) {
    assert.equal(isUnplayedQualifierResult({ ...qualifier, team1_score: score }), false);
  }
  assert.equal(isUnplayedQualifierResult({ ...qualifier, status: "MATCH_STATUS_FINISHED" }), true);
});
