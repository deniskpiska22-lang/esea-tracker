import { COUNTRY_CODES, countryName } from './countries.js';
import { currentLocale } from '../i18n/languages.js';

// Geographic country/territory groups; preserve the site's established Europe
// convention for Türkiye, Cyprus and Georgia. North America includes the
// Caribbean and Central America (UN M49's North America grouping).
const COUNTRY_GROUPS = {
  Europe: 'AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GE GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM TR UA VA XK EU',
  'North America': 'AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI',
  'South America': 'AR BO BR BV CL CO EC FK GF GS GY PE PY SR UY VE',
  Asia: 'AE AF AM AZ BD BH BN BT CN HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TW UZ VN YE',
  Oceania: 'AS AU CC CK CX FJ FM GU HM KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS',
  Africa: 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW IO KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TF TG TN TZ UG YT ZA ZM ZW',
  Antarctica: 'AQ',
};
export const RANKING_REGION_BY_COUNTRY = Object.freeze(Object.fromEntries(
  Object.entries(COUNTRY_GROUPS).flatMap(([region, codes]) => codes.split(' ').map(code => [code, region]))
));

export function normalizeRankingCountry(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (code === 'UK') return 'GB';
  return COUNTRY_CODES.includes(code) || code === 'EU' ? code : '';
}

// League region still scopes teams and counts, but it cannot put an unrelated
// country's flag in this region's selector. Do not change stored league data.
export function rankingCountryOptions(teams, region, locale = currentLocale()) {
  const counts = new Map();
  for (const team of teams) {
    if (region !== 'All' && team.region !== region) continue;
    const code = normalizeRankingCountry(team.country);
    if (region !== 'All' && RANKING_REGION_BY_COUNTRY[code] !== region) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  const collator = new Intl.Collator(locale);
  return [...counts].map(([code, count]) => ({ code, count })).sort((a, b) => {
    if (!a.code || !b.code) return Number(!a.code) - Number(!b.code);
    return collator.compare(countryName(a.code, locale) || a.code, countryName(b.code, locale) || b.code);
  });
}
