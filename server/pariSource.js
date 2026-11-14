import { sameOneWinPair } from '../src/utils/onewinMatch.js';

const LINE = 'https://line-vk01-w.pb06e2-resources.ru/events/listBase?lang=ru&scopeMarket=2300';
const MAX_BYTES = 24 * 1024 * 1024;
export const PARI_TTL_MS = 60_000;
const WINDOW_MS = 48 * 60 * 60_000;
const CS2 = 20;
const ESPORTS = 29086;

function tournamentPriority(name) {
  if (/\bmajor\b|\bblast\b|\biem\b|esl pro league/i.test(name)) return 2;
  return /esea.*advanced/i.test(name) ? 1 : 0;
}

export function parsePariLine(data, now) {
  if (![data?.sports, data?.events, data?.customFactors, data?.eventBlocks].every(Array.isArray)) {
    throw new Error('Unexpected PARI line format');
  }
  const tournaments = new Map(data.sports
    .filter(s => s.parentId === ESPORTS && s.sportCategoryId === CS2 &&
      /^Counter-Strike\./i.test(s.name) &&
      !/сравнение|итоги турнира|h2h|replay|[12][xх][12]/i.test(s.name))
    .map(s => [s.id, s.name]));
  const factors = new Map(data.customFactors.map(row => [row.e, row.factors]));
  const blocked = new Set(data.eventBlocks.filter(row => row.state !== 'unblocked').map(row => row.eventId));

  return data.events.flatMap(event => {
    const tournament = tournaments.get(event.sportId);
    const startsAt = event.startTime * 1000;
    const team1 = typeof event.team1 === 'string' && event.team1.trim();
    const team2 = typeof event.team2 === 'string' && event.team2.trim();
    if (!tournament || !Number.isSafeInteger(event.id) || event.id <= 0 ||
      event.level !== 1 || event.kind !== 1 || event.parentId || event.place !== 'line' ||
      !team1 || !team2 || team1 === team2 || !Number.isFinite(startsAt) ||
      startsAt <= now || startsAt > now + WINDOW_MS || blocked.has(event.id)) return [];

    const markets = factors.get(event.id);
    if (!Array.isArray(markets)) return [];
    // Factor codes 921/923 are match outcomes 1/2; 922 is the draw.
    if (markets.some(row => row.f === 922 && row.v > 1)) return [];
    const sides = [921, 923].map(code => markets.filter(row => row.f === code && row.p == null));
    if (sides.some(side => side.length !== 1 || !Number.isFinite(side[0].v) ||
      side[0].v <= 1 || side[0].v > 1000)) return [];
    return [{ eventId: event.id, startsAt, tournament,
      team1: { name: team1, price: sides[0][0].v }, team2: { name: team2, price: sides[1][0].v } }];
  }).sort((a, b) => tournamentPriority(b.tournament) - tournamentPriority(a.tournament) || a.startsAt - b.startsAt);
}

let pending;
let cached;
let retryAfter = 0;
export async function getPariLine() {
  if (cached?.fetchedAt + 45_000 > Date.now()) return cached;
  if (pending) return pending;
  if (retryAfter > Date.now()) throw new Error('PARI line temporarily unavailable');
  pending = (async () => {
    const response = await fetch(LINE, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(9000) });
    if (!response.ok || !response.body) throw new Error(`PARI returned HTTP ${response.status}`);
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error('PARI line was too large');
      }
      chunks.push(value);
    }
    const age = Number(response.headers.get('age'));
    const fetchedAt = Date.now() - (Number.isFinite(age) ? Math.max(0, age) * 1000 : 0);
    const data = JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
    cached = { rows: parsePariLine(data, Date.now()), fetchedAt };
    return cached;
  })().catch(error => {
    retryAfter = Date.now() + 30_000;
    throw error;
  }).finally(() => { pending = null; });
  return pending;
}

export function selectPariFeatured(line, currentMatch, now) {
  const remaining = PARI_TTL_MS - (now - line.fetchedAt);
  if (!(remaining > 0 && remaining <= PARI_TTL_MS)) return [];
  const seen = new Set();
  return line.rows.flatMap(row => {
    const validForMs = Math.min(row.startsAt - now, remaining);
    const pair = [row.team1.name, row.team2.name].map(name => name.toLowerCase()).sort().join(':');
    if (validForMs <= 0 || seen.has(pair) ||
      sameOneWinPair(currentMatch, { homeTeam: row.team1, awayTeam: row.team2 })) return [];
    seen.add(pair);
    return [{ ...row, validForMs }];
  }).slice(0, 2);
}
