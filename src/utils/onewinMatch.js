export const ONEWIN_ODDS_TTL_MS = 20_000;
export function isOneWinSourceOrigin(origin) {
  return typeof origin === 'string' && /^https:\/\/one-vv\d+\.com$/.test(origin);
}
const ACTIVE = new Set(['SCHEDULED', 'MATCH_STATUS_SCHEDULED', 'LIVE', 'ONGOING', 'READY', 'VOTING', 'CONFIGURING', 'PAUSED', 'MATCH_STATUS_ONGOING', 'MATCH_STATUS_READY', 'MATCH_STATUS_VOTING', 'MATCH_STATUS_CONFIGURING', 'MATCH_STATUS_PAUSED']);

// Verified bookmaker abbreviations belong to a specific FACEIT roster. Do not
// globally remove "Gaming", "Academy", etc. or match unrelated namesakes.
const ONEWIN_TEAM_ALIASES = new Map([
  ['8b7c27bc-3837-4ffd-9e13-48b477b003b3', new Set(['innercircleprospects'])],
  ['7536d4f2-21b1-42ec-b70b-e6c7bc5789d6', new Set(['berg'])],
  ['51aa82a4-7ac4-49f2-8b88-f710dc0de1d6', new Set(['clutchain'])],
  ['40ee7839-d6df-4086-8c8f-ca998c9aedbf', new Set(['hermine'])],
  ['1f98d0ae-c844-4356-adf6-70e9501aba2a', new Set(['lph'])],
  ['8de7892a-dc7a-4ac7-9620-f02522c75609', new Set(['ttg'])],
  ['052f75bf-65dc-497c-86f2-e68880ec1171', new Set(['diamant'])],
  ['fe66f943-b5ab-46f6-9f43-c3ed3b9b904a', new Set(['growthlab'])],
  ['96a5ba01-176e-4472-ac22-0e027c9093a7', new Set(['phantomacademy'])],
  ['934a2bd0-fa66-4c02-ac92-00f742e7ec55', new Set(['jumbo'])],
  ['add80f4e-86e7-454a-8f3e-93c8349a39a3', new Set(['honved'])],
]);

export function normalizeOddsTeam(name) {
  // Keep Academy, Junior, NXT, Team, etc. They identify different rosters.
  return String(name || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function isOddsMatchActive(match) {
  return ACTIVE.has(String(match?.status || '').toUpperCase());
}

function matchesOddsTeam(name, id, providerName) {
  const provider = normalizeOddsTeam(providerName);
  return Boolean(provider && (normalizeOddsTeam(name) === provider ||
    ONEWIN_TEAM_ALIASES.get(id)?.has(provider)));
}

export function findOneWinMatch(match, events) {
  if (!isOddsMatchActive(match)) return null;
  const scheduled = Date.parse(match.scheduled_at);
  const left = normalizeOddsTeam(match.team1_name);
  const right = normalizeOddsTeam(match.team2_name);
  if (!Number.isFinite(scheduled) || !left || !right || left === right) return null;
  const candidates = events.filter(event => {
    if (Number(event.sportId) !== 142 || !Number.isSafeInteger(event.id) || event.id <= 0) return false;
    // Bookmakers also list simulated replays, outright winners and player duels.
    if (/replay|1x1|players-duel|outright/i.test(`${event.name} ${event.tournament?.slug}`)) return false;
    const first = normalizeOddsTeam(event.homeTeam?.name);
    const second = normalizeOddsTeam(event.awayTeam?.name);
    const samePair =
      (matchesOddsTeam(left, match.team1_id, first) && matchesOddsTeam(right, match.team2_id, second)) ||
      (matchesOddsTeam(left, match.team1_id, second) && matchesOddsTeam(right, match.team2_id, first));
    return samePair && Math.abs(Number(event.startAt) * 1000 - scheduled) <= 90 * 60_000;
  });
  // Never guess between two meetings of the same teams.
  return candidates.length === 1 ? candidates[0] : null;
}

function isWholeMatchWinner(odd) {
  const side = odd.outcome === '1' ? '1' : odd.outcome === '2' ? '3' : null;
  if (!side) return false;
  const legacy = String(odd.id).match(/^\d+:\d+:_:1:(1|3):_:_$/);
  if (legacy) return legacy[1] === side;
  // The live feed uses a second public ID format. Its third tuple member
  // identifies the map: [0] is the whole match, [1]/[2]/[3] are individual maps.
  const live = String(odd.id).match(/^12:[LP]:\d+:(\[.*\])$/);
  if (!live) return false;
  try {
    const value = JSON.parse(live[1]);
    return value.length === 6 && value[0] === 1 && Array.isArray(value[1]) && value[1].length === 0 &&
      Array.isArray(value[2]) && value[2].length === 1 && value[2][0] === 0 && value[3] === 1 &&
      value[4] === (side === '1' ? 0 : 3) && Array.isArray(value[5]) && value[5].length === 0;
  } catch { return false; }
}

export function extractOneWinWinner(snapshot, event) {
  if (snapshot?.matchId !== event?.id || !Array.isArray(snapshot.oddsGroups)) return null;
  const groups = snapshot.oddsGroups.filter(group => {
    if (!group.isBase || group.blocked || Number(group.order) !== 0 || group.oddsList?.length !== 2) return false;
    // Root match winner market (not map winner, handicap, totals, or a draw).
    return group.oddsList.every(isWholeMatchWinner) &&
      ['1', '2'].every(outcome => group.oddsList.filter(odd => odd.outcome === outcome).length === 1);
  });
  if (groups.length !== 1) return null;
  const home = groups[0].oddsList.find(odd => odd.outcome === '1');
  const away = groups[0].oddsList.find(odd => odd.outcome === '2');
  if ([home, away].some(odd => odd.status !== 1 || !Number.isFinite(odd.cf) || odd.cf <= 1 || odd.cf > 1000)) return null;
  if (normalizeOddsTeam(home.name) !== normalizeOddsTeam(event.homeTeam?.name) ||
      normalizeOddsTeam(away.name) !== normalizeOddsTeam(event.awayTeam?.name)) return null;
  return { home: home.cf, away: away.cf };
}

export function orientOneWinOdds(match, event, prices) {
  const homeFirst = matchesOddsTeam(match.team1_name, match.team1_id, event.homeTeam.name);
  return { team1: homeFirst ? prices.home : prices.away, team2: homeFirst ? prices.away : prices.home };
}

export function buildOneWinMatchUrl(event) {
  if (!Number.isSafeInteger(event?.id) || event.id <= 0 || !/^[a-z0-9-]+$/i.test(event.slug || '')) return null;
  const origin = event.sourceOrigin || 'https://one-vv4852.com';
  if (!isOneWinSourceOrigin(origin)) return null;
  const url = new URL(`/betting/match/esport/${event.slug}-${event.id}`, origin);
  url.searchParams.set('service', event.serviceV2 === 'live' ? 'live' : 'prematch');
  url.searchParams.set('p', 'g39d');
  return url.href;
}
