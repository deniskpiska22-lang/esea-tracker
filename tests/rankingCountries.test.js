import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRankingCountry, rankingCountryOptions, RANKING_REGION_BY_COUNTRY } from '../src/utils/rankingCountries.js';
import { COUNTRY_CODES } from '../src/utils/countries.js';
import { scopeTeamRanks } from '../src/utils/teamRanks.js';

test('rare European countries stay selectable while unrelated flags are excluded', () => {
  const teams = ['CZ', 'ES', 'RS', 'BY', 'AM', 'US', 'XK'].map((country, i) => ({ country, region: 'Europe', rank: i + 1 }));
  teams.push({ country: 'US', region: 'North America' }, { country: 'CZ', region: 'North America' });
  const options = rankingCountryOptions(teams, 'Europe', 'en');
  assert.deepEqual(new Set(options.map(row => row.code)), new Set(['CZ', 'ES', 'RS', 'BY', 'XK']));
  for (const { code, count } of options) {
    assert.equal(count, scopeTeamRanks(teams, 'Europe', code).length);
  }
  assert.equal(options.reduce((sum, row) => sum + row.count, 0), 5);
  assert.equal(rankingCountryOptions(teams, 'All').find(row => row.code === 'US').count, 2);
  assert.deepEqual(rankingCountryOptions(teams, 'Africa'), []);
});

test('unknown flags are not assigned a continent; aliases and whitespace normalize', () => {
  const teams = ['XX', 'INT', '', null, ' uk ', ' de '].map(country => ({ country: normalizeRankingCountry(country), region: 'Europe' }));
  const options = rankingCountryOptions(teams, 'Europe', 'en');
  assert.deepEqual(new Set(options.map(row => row.code)), new Set(['GB', 'DE']));
  assert.deepEqual(rankingCountryOptions(teams, 'All', 'en').at(-1), { code: '', count: 4 });
  assert.equal(scopeTeamRanks(teams, 'Europe', '').length, 4);
  assert.equal(normalizeRankingCountry('UK'), 'GB');
  assert.equal(normalizeRankingCountry('EU'), 'EU');
  assert.equal(normalizeRankingCountry('made-up'), '');
});

test('every supported country has a geographic group, independent of league membership', () => {
  assert.deepEqual(COUNTRY_CODES.filter(code => !RANKING_REGION_BY_COUNTRY[code]), []);
  const codes = ['US', 'CA', 'MX', 'JM', 'FR', 'CN', 'BR', 'AQ', 'AU', 'ZA'];
  for (const region of ['North America', 'South America', 'Asia', 'Europe', 'Oceania', 'Africa']) {
    const teams = codes.map(country => ({ country, region }));
    const options = rankingCountryOptions(teams, region, 'en');
    assert.deepEqual(new Set(options.map(row => row.code)), new Set(codes.filter(code => RANKING_REGION_BY_COUNTRY[code] === region)));
    // Display rules must never mutate a team's league region or flag.
    assert.deepEqual(teams, codes.map(country => ({ country, region })));
  }
});

test('country ordering follows the selected language', () => {
  const teams = ['DE', 'ES', 'FR'].map(country => ({ country, region: 'Europe' }));
  assert.deepEqual(rankingCountryOptions(teams, 'Europe', 'en').map(row => row.code), ['FR', 'DE', 'ES']);
  assert.deepEqual(rankingCountryOptions(teams, 'Europe', 'de').map(row => row.code), ['DE', 'FR', 'ES']);
});
