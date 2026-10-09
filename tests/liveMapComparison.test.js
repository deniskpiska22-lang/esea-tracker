import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveMapComparison, normalizeLiveVeto } from '../src/utils/liveMapComparison.js';
const now = Date.parse('2026-10-09T12:00:00Z');
const game = (id, map = 'de_nuke', left = 13, right = 8, date = '2026-10-08') => ({ id, date, mapScores: [{ map, teamScore: left, opponentScore: right }] });
const nuke = matches => buildLiveMapComparison(matches, { now, excludeMatchId: 'live' }).find(row => row.name === 'Nuke');
test('90-day window, duplicate/current games and all maps in BO3', () => {
  const series = game('series');
  series.mapScores.push({ map: 'de_mirage', teamScore: 10, opponentScore: 13 });
  const matches = [series, game('b'), game('c', 'Nuke', 9, 13), game('b'), game('live'), game('old', 'Nuke', 13, 8, '2026-06-01'), game('future', 'Nuke', 13, 8, '2026-10-10')];
  assert.equal(nuke(matches).played, 3);
  assert.equal(nuke(matches).win, 67);
  assert.equal(buildLiveMapComparison(matches, { now }).find(row => row.name === 'Mirage').played, 1);
});
test('missing/insufficient results never masquerade as zero win rate', () => {
  assert.equal(nuke([]).win, null);
  assert.equal(nuke([game('a'),game('b')]).win, null);
  assert.equal(nuke([game('tied','Nuke',0,0)]).played, 0);
  assert.equal(nuke([game('a','Nuke',2,13),game('b','Nuke',2,13),game('c','Nuke',2,13)]).win, 0);
});
test('pick/ban use known own veto history, excluding opponents and deciders', () => {
  const a = game('a'), b = game('b'), c = game('c');
  a.vetoSteps = [{ map: 'Nuke', action: 'Picked', side: 'team' }, { map: 'Mirage', action: 'Banned', side: 'team' }];
  b.vetoSteps = [{ map: 'Nuke', action: 'Banned', side: 'team' }, { map: 'Mirage', action: 'Picked', side: 'opponent' }];
  c.vetoSteps = [{ map: 'Nuke', action: 'Decider', side: null }];
  const record = nuke([a,b,c,game('no-veto')]);
  assert.equal(record.vetoMatches, 2);
  assert.equal(record.pick, 50);
  assert.equal(record.ban, 50);
  assert.equal(nuke([game('no-veto')]).pick, null);
});

test('live veto preserves faction ownership and never attributes the decider', () => {
  const steps = normalizeLiveVeto({payload:{tickets:[{entity_type:'map',entities:[
    {guid:'de_nuke',round:2,status:'pick',selected_by:'faction2'},
    {guid:'de_mirage',round:1,status:'drop',selected_by:'faction1'},
    {guid:'de_ancient',round:3,status:'pick',selected_by:'faction1'},
  ]}]}});
  assert.equal(steps[0].action,'Banned');
  assert.equal(steps[1].selectedBy,'faction2');
  assert.equal(steps[2].action,'Decider');
  assert.equal(steps[2].selectedBy,null);
});
