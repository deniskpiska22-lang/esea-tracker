import test from 'node:test';
import assert from 'node:assert/strict';
import { competitionDisplayName, groupCompetitionMatches } from '../src/utils/competitionGroups.js';
const title = 'S59 Europe Main A - Regular Season';
const match = (id, season, competitionId) => ({ id, season, competitionId });

test('Europe and EU records from the screenshot share one championship and one header', () => {
  const rows = [match('oct15',title,'same-faceit-id'),match('oct13','S59 EU Main A - Regular Season','same-faceit-id')];
  const groups = groupCompetitionMatches(rows);
  assert.equal(groups.length,1);
  assert.equal(groups[0].season,title);
  assert.deepEqual(groups[0].matches.map(m=>m.id),['oct15','oct13']);
});

test('championship identity survives source renaming beyond the region abbreviation', () => {
  const groups=groupCompetitionMatches([match('a',title,'fixed-id'),match('b','Old FACEIT title','fixed-id')]);
  assert.equal(groups.length,1);
});

test('legacy rows without IDs join the unique matching championship regardless of row order', () => {
  for(const rows of [
    [match('a','S59 EU Main A - Regular Season'),match('b',title,'fixed-id')],
    [match('b',title,'fixed-id'),match('a','S59 EU Main A - Regular Season')],
  ]) {
    const groups=groupCompetitionMatches(rows);
    assert.equal(groups.length,1);
    assert.equal(groups[0].season,title);
    assert.equal(groups[0].matches.length,2);
  }
});

test('different seasons, divisions, conferences, stages and regions remain separate', () => {
  const titles=[title,'S58 EU Main A - Regular Season','S59 EU Main B - Regular Season',
    'S59 EU Advanced Central - Regular Season','S59 EU Main A - Playoffs',
    'S59 EU Season Finals Central - Finals','S59 NA Main A - Regular Season'];
  assert.equal(groupCompetitionMatches(titles.map((name,i)=>match(i,name))).length,titles.length);
});

test('distinct championship IDs with identical labels are not conflated with ambiguous legacy rows', () => {
  const groups=groupCompetitionMatches([match('a',title,'one'),match('b',title,'two'),match('legacy',title)]);
  assert.equal(groups.length,3);
  assert.equal(new Set(groups.map(g=>g.key)).size,3);
});

test('regional aliases and punctuation normalize, while actual qualifier names retain their identity', () => {
  assert.equal(competitionDisplayName(' S59 NA Main A - Regular Season '),'S59 North America Main A - Regular Season');
  assert.equal(competitionDisplayName('S59 SA Main A - Regular Season'),'S59 South America Main A - Regular Season');
  assert.equal(competitionDisplayName('CCT 2026 Contenders Europe 11 - Open Qualifier 1'),'CCT 2026 Contenders Europe 11 - Open Qualifier 1');
  const groups=groupCompetitionMatches([match('a','s59 eu main a – regular season'),match('b','S59 Europe Main A-Regular Season')]);
  assert.equal(groups.length,1);
  assert.equal(groupCompetitionMatches([match('a','Qualifier 1'),match('b','Qualifier 2')]).length,2);
});
