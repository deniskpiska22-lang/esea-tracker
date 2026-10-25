import test from 'node:test';
import assert from 'node:assert/strict';
import teams from '../src/data/teams.generated.js';
import { resolveTeamStatsIdentity } from '../src/utils/teamStatsIdentity.js';
import { normalizeTeamMapHistory } from '../src/utils/teamMapStats.js';
import { buildLiveMapComparison } from '../src/utils/liveMapComparison.js';

const id = 'b5a6cd54-5cec-44ff-8b00-c6adcdfffd0c';
const opponent = 'b7061158-1f49-45ba-a88d-899d003cbc0c';

test('Open10 OldBoys history loads by ID even when only Advanced namesakes are bundled', () => {
  assert.ok(!teams.some(team => team.faceitTeamId === id));
  assert.deepEqual(resolveTeamStatsIdentity(teams, id), { faceitTeamId: id });
  assert.deepEqual(resolveTeamStatsIdentity([], id), { faceitTeamId: id });
});

test('existing profile slugs and aliases still resolve while invalid keys do not select arbitrary teams', () => {
  const team = { faceitTeamId: id, slug: 'oldboys-b5a6cd54', profileSlug: 'oldboys-3', urlAliases: ['old-name'] };
  for (const key of [id, team.slug, team.profileSlug, 'old-name']) {
    assert.equal(resolveTeamStatsIdentity([team], key), team);
  }
  for (const key of [undefined, '', 'OldBoys', 'missing-slug', `${id},team1_id.neq.null`]) {
    assert.equal(resolveTeamStatsIdentity([team], key), null);
  }
});

test('the OldBoys Nuke results count both faction positions without counting a technical award', () => {
  const team = resolveTeamStatsIdentity(teams, id);
  const rows = [
    { id: 'win', status: 'FINISHED', finished_at: '2026-10-14', team1_id: id, team2_id: opponent,
      team1_score: 1, team2_score: 0, map_scores: [{ map: 'Nuke', team1_id: id, team2_id: opponent, team1_score: 13, team2_score: 10 }] },
    { id: 'loss', status: 'FINISHED', finished_at: '2026-10-05', team1_id: opponent, team2_id: id,
      team1_score: 1, team2_score: 0, map_scores: [{ map: 'de_nuke', team1_id: opponent, team2_id: id, team1_score: 13, team2_score: 4 }] },
    { id: 'technical', status: 'FINISHED', finished_at: '2026-10-19', team1_id: id, team2_id: opponent,
      team1_score: 1, team2_score: 0, maps: ['Nuke'], map_scores: [] },
  ];
  const history = normalizeTeamMapHistory(rows, team.faceitTeamId);
  const nuke = buildLiveMapComparison(history, { now: Date.parse('2026-10-25T21:30:00Z') }).find(row => row.name === 'Nuke');
  assert.equal(nuke.played, 2);
  assert.equal(nuke.wins, 1);
  // Keep the existing three-map minimum for the percentage; the sample is still displayed.
  assert.equal(nuke.win, null);
});
