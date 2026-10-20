import test from 'node:test';
import assert from 'node:assert/strict';
import { upcomingDivision, countUpcomingDivisions, filterUpcomingDivision } from '../src/utils/upcomingDivisions.js';

test('every supported division is recognized in FACEIT competition names', () => {
  for (const division of ['Advanced','Main','Intermediate','Entry','Open10']) {
    assert.equal(upcomingDivision({season:`S59 EU ${division} Central - Regular Season`}), division);
  }
  for (const spelling of ['OPEN10','Open 10','open-10','Open_10']) {
    assert.equal(upcomingDivision({competition_name:`S59 North America ${spelling} B - Playoffs`}), 'Open10');
  }
  assert.equal(upcomingDivision({division:'intermediate'}), 'Intermediate');
});
test('competition identity wins over a promoted team and ambiguous events stay in All', () => {
  assert.equal(upcomingDivision({season:'S58 EU Entry - Playoffs',team1:{division:'Main'},team2:{division:'Main'}}), 'Entry');
  for (const season of ['S59 EU Open - Regular Season','CCT Main Event','ESEA Finals S59','S59 Open100']) {
    assert.equal(upcomingDivision({season}), null);
  }
  assert.equal(upcomingDivision({}), null);
});
test('division counts include unknown events in All and filtered matches retain chronological order', () => {
  const matches=[{id:'first',season:'S59 EU Main A'}, {id:'second',season:'S59 EU Open10 B'},
    {id:'third',season:'S59 EU Main B'}, {id:'final',season:'ESEA Finals S59'}];
  assert.deepEqual(countUpcomingDivisions(matches),{All:4,Advanced:0,Main:2,Intermediate:0,Entry:0,Open10:1});
  assert.deepEqual(filterUpcomingDivision(matches,'Main').map(m=>m.id), ['first','third']);
  assert.deepEqual(filterUpcomingDivision(matches,'All'),matches);
  assert.deepEqual(filterUpcomingDivision(matches,'Advanced'),[]);
});
