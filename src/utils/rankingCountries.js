import { COUNTRY_CODES, countryName } from './countries.js';
import { currentLocale } from '../i18n/languages.js';

export function normalizeRankingCountry(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (code === 'UK') return 'GB';
  return COUNTRY_CODES.includes(code) || code === 'EU' ? code : '';
}

// Region is the team's league region, not the geography of its chosen flag.
// Derive every option and its count from exactly the rows the filter displays.
export function rankingCountryOptions(teams, region, locale = currentLocale()) {
  const counts = new Map();
  for (const team of teams) {
    if (region !== 'All' && team.region !== region) continue;
    const code = normalizeRankingCountry(team.country);
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  const collator = new Intl.Collator(locale);
  return [...counts].map(([code, count]) => ({ code, count })).sort((a, b) => {
    if (!a.code || !b.code) return Number(!a.code) - Number(!b.code);
    return collator.compare(countryName(a.code, locale) || a.code, countryName(b.code, locale) || b.code);
  });
}
