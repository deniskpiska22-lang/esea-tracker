import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRankingCountry, rankingCountryOptions } from '../src/utils/rankingCountries.js';
import { scopeTeamRanks } from '../src/utils/teamRanks.js';

test('every country present in a league region is selectable, including flags from other continents', () => {
  const teams = ['CZ', 'ES', 'RS', 'BY', 'AM', 'US', 'XK'].map((country, i) => ({ country, region: 'Europe', rank: i + 1 }));
  teams.push({ country: 'US', region: 'North America' }, { country: 'CZ', region: 'North America' });
  const options = rankingCountryOptions(teams, 'Europe', 'en');
  assert.deepEqual(new Set(options.map(row => row.code)), new Set(['CZ', 'ES', 'RS', 'BY', 'AM', 'US', 'XK']));
  for (const { code, count } of options) {
    assert.equal(count, scopeTeamRanks(teams, 'Europe', code).length);
  }
  assert.equal(options.reduce((sum, row) => sum + row.count, 0), 7);
  assert.equal(rankingCountryOptions(teams, 'All').find(row => row.code === 'US').count, 2);
  assert.deepEqual(rankingCountryOptions(teams, 'Africa'), []);
});

test('unknown flags stay selectable as one truthful group; aliases and whitespace normalize', () => {
  const teams = ['XX', 'INT', '', null, ' uk ', ' de '].map(country => ({ country: normalizeRankingCountry(country), region: 'Europe' }));
  const options = rankingCountryOptions(teams, 'Europe', 'en');
  assert.deepEqual(options.at(-1), { code: '', count: 4 });
  assert.equal(scopeTeamRanks(teams, 'Europe', '').length, 4);
  assert.equal(normalizeRankingCountry('UK'), 'GB');
  assert.equal(normalizeRankingCountry('EU'), 'EU');
  assert.equal(normalizeRankingCountry('made-up'), '');
});

test('country ordering follows the selected language', () => {
  const teams = ['DE', 'ES', 'FR'].map(country => ({ country, region: 'Europe' }));
  assert.deepEqual(rankingCountryOptions(teams, 'Europe', 'en').map(row => row.code), ['FR', 'DE', 'ES']);
  assert.deepEqual(rankingCountryOptions(teams, 'Europe', 'de').map(row => row.code), ['DE', 'FR', 'ES']);
});
