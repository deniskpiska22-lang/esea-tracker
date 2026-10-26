import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOneWinMatchUrl, extractOneWinWinner, findOneWinMatch, normalizeOddsTeam, orientOneWinOdds } from '../src/utils/onewinMatch.js';
import { configuredOneWinSource, readOneWinPage, readOneWinSnapshot } from '../server/onewinSource.js';
import { createMatchOddsHandler } from '../api/match-odds.js';

test('public client configuration fixes the API origin and refuses incomplete or arbitrary sources', () => {
  assert.equal(configuredOneWinSource({}), null);
  const env = { ONEWIN_PUBLIC_PARTNER_ID: '44ba10e5-7df2-47ab-a44d-dc93803c7a6e', ONEWIN_PUBLIC_SOURCE_ORIGIN: 'https://one-vv8346.com' };
  assert.deepEqual(configuredOneWinSource(env), { apiUrl: 'https://api-gateway.top-parser.com', partnerId: env.ONEWIN_PUBLIC_PARTNER_ID, sourceOrigin: env.ONEWIN_PUBLIC_SOURCE_ORIGIN });
  for (const patch of [
    { ONEWIN_PUBLIC_PARTNER_ID: '' }, { ONEWIN_PUBLIC_PARTNER_ID: 'not-a-uuid' },
    { ONEWIN_PUBLIC_SOURCE_ORIGIN: '' }, { ONEWIN_PUBLIC_SOURCE_ORIGIN: 'https://example.com' },
    { ONEWIN_PUBLIC_SOURCE_ORIGIN: 'http://one-vv8346.com' },
    { ONEWIN_PUBLIC_SOURCE_ORIGIN: 'https://one-vv8346.com:9000' },
    { ONEWIN_PUBLIC_SOURCE_ORIGIN: 'https://user:pass@one-vv8346.com' },
  ]) assert.throws(() => configuredOneWinSource({ ...env, ...patch }), /Invalid/);
});

// Captured from the provider's public event feed and winner snapshot. The second
// market is a map winner and must never be displayed as the match winner.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/onewin-public-market.json', import.meta.url), 'utf8'));
const { event, snapshot } = fixture;
const match = {
  id: '1-01234567-89ab-cdef-0123-456789abcdef', status: 'SCHEDULED',
  scheduled_at: new Date(event.startAt * 1000).toISOString(), team1_name: 'magic', team2_name: 'BIG',
};
const currentTime = Date.parse(fixture.capturedAt);
const freshSnapshot = () => ({ data: structuredClone(snapshot), fetchedAt: currentTime });
const dnkFixture = JSON.parse(readFileSync(new URL('./fixtures/onewin-dnk-lph-market.json', import.meta.url), 'utf8'));
const dnkMatch = {
  id: '1-19ff85af-b700-41a2-a23b-4722323b0a03', status: 'SCHEDULED', scheduled_at: '2026-10-26T18:00:00Z',
  team1_id: '3c170b46-04a8-443a-9605-cfd3e03cd020', team1_name: 'DNK',
  team2_id: '1f98d0ae-c844-4356-adf6-70e9501aba2a', team2_name: 'LPH Gaming',
};

test('DNK vs LPH Gaming matches the captured LPH market only through its verified FACEIT identity', () => {
  const { event } = dnkFixture;
  assert.equal(findOneWinMatch(dnkMatch, [event]), event);
  for (const team2_id of [undefined, 'other-roster']) {
    assert.equal(findOneWinMatch({ ...dnkMatch, team2_id }, [event]), null);
  }
  assert.equal(findOneWinMatch({ ...dnkMatch, team2_id: 'other-roster', team2_name: 'LPH Academy' }, [event]), null);
  assert.equal(findOneWinMatch({ ...dnkMatch, scheduled_at: '2026-10-26T17:59:59Z' }, [event]), null);
  assert.equal(findOneWinMatch(dnkMatch, [event, { ...event, id: event.id + 1 }]), null);
});

test('verified abbreviations retain the correct prices in either site or provider orientation', () => {
  const { event, snapshot } = dnkFixture;
  const prices = extractOneWinWinner(snapshot, event);
  assert.deepEqual(prices, { home: 3.2, away: 1.3 });
  assert.deepEqual(orientOneWinOdds(dnkMatch, event, prices), { team1: 3.2, team2: 1.3 });
  const reversed = { ...dnkMatch,
    team1_id: dnkMatch.team2_id, team1_name: dnkMatch.team2_name,
    team2_id: dnkMatch.team1_id, team2_name: dnkMatch.team1_name };
  assert.equal(findOneWinMatch(reversed, [event]), event);
  assert.deepEqual(orientOneWinOdds(reversed, event, prices), { team1: 1.3, team2: 3.2 });
  const flippedEvent = { ...event, homeTeam: event.awayTeam, awayTeam: event.homeTeam };
  assert.equal(findOneWinMatch(dnkMatch, [flippedEvent]), flippedEvent);
  assert.deepEqual(orientOneWinOdds(dnkMatch, flippedEvent, { home: 1.3, away: 3.2 }), { team1: 3.2, team2: 1.3 });
});

test('matches the exact pair across punctuation, accents and orientation', () => {
  assert.equal(normalizeOddsTeam('TÉAM-B.I.G'), 'teambig');
  assert.equal(findOneWinMatch({ ...match, team1_name: 'MAGIC', team2_name: 'B.I.G' }, [event]), event);
  assert.equal(findOneWinMatch({ ...match, team1_name: 'BIG', team2_name: 'magic' }, [event]), event);
  assert.deepEqual(orientOneWinOdds({ ...match, team1_name: 'BIG', team2_name: 'magic' }, event, { home: 1.9, away: 1.8 }), { team1: 1.8, team2: 1.9 });
});

test('refuses another roster, opponent, day, completed match or ambiguous event', () => {
  for (const change of [
    { team1_name: 'magic Academy' }, { team2_name: 'BIG NXT' }, { team2_name: 'Nemesis' },
    { scheduled_at: new Date((event.startAt + 91 * 60) * 1000).toISOString() },
    { scheduled_at: 'invalid' }, { status: 'FINISHED' }, { status: 'CANCELLED' },
  ]) assert.equal(findOneWinMatch({ ...match, ...change }, [event]), null);
  assert.equal(findOneWinMatch(match, [event, { ...event, id: event.id + 1 }]), null);
});

test('rejects player duels, replays and non-CS2 events', () => {
  for (const change of [
    { sportId: 1 }, { id: -1 }, { id: '41554587' }, { name: 'Replay magic - BIG' },
    { tournament: { slug: 'cs2-1x1' } }, { tournament: { slug: 'players-duel' } },
    { tournament: { slug: 'outright' } },
  ]) assert.equal(findOneWinMatch(match, [{ ...event, ...change }]), null);
});

test('extracts the whole-match winner from the actual public snapshot', () => {
  assert.deepEqual(extractOneWinWinner(snapshot, event), { home: 1.9, away: 1.8 });
  assert.equal(extractOneWinWinner({ ...snapshot, oddsGroups: [snapshot.oddsGroups[1]] }, event), null);
  assert.equal(extractOneWinWinner({ ...snapshot, matchId: event.id + 1 }, event), null);
});

test('reads the actual live winner format while excluding map and total tuples', () => {
  const live = JSON.parse(readFileSync(new URL('./fixtures/onewin-public-live-market.json', import.meta.url), 'utf8'));
  assert.deepEqual(extractOneWinWinner(live.snapshot, live.event), { home: 5.8, away: 1.1 });
  for (const suffix of ['[1,[],[2],1,0,[]]', '[264,[2.5],[0],1,4,[]]', '[1,[],[0],1,3,[]]', '[1,[],[0],1,0,[]]extra']) {
    const data = structuredClone(live.snapshot);
    data.oddsGroups[0].oddsList[0].id = `12:L:19183031:${suffix}`;
    assert.equal(extractOneWinWinner(data, live.event), null);
  }
});

test('hides blocked, suspended, malformed, duplicate or mislabelled markets', () => {
  const invalid = [
    s => { s.oddsGroups[0].blocked = true; },
    s => { s.oddsGroups[0].isBase = false; },
    s => { s.oddsGroups[0].oddsList[0].status = 2; },
    s => { s.oddsGroups[0].oddsList[1].status = 0; },
    s => { s.oddsGroups[0].oddsList[0].cf = NaN; },
    s => { s.oddsGroups[0].oddsList[0].cf = '1.9'; },
    s => { s.oddsGroups[0].oddsList[0].cf = 1; },
    s => { s.oddsGroups[0].oddsList[0].cf = 1001; },
    s => { s.oddsGroups[0].oddsList[0].name = 'magic Academy'; },
    s => { s.oddsGroups[0].oddsList[0].id = '1:761868842:761868843:1:1:_:_'; },
    s => { s.oddsGroups[0].oddsList[1].outcome = '1'; },
    s => { s.oddsGroups.push(structuredClone(s.oddsGroups[0])); },
  ];
  for (const mutate of invalid) {
    const data = structuredClone(snapshot);
    mutate(data);
    assert.equal(extractOneWinWinner(data, event), null);
  }
});

test('deep-links only to the fixed 1win domain with the existing affiliate', () => {
  const url = new URL(buildOneWinMatchUrl(event));
  assert.equal(url.origin, 'https://one-vv4852.com');
  assert.equal(url.pathname, '/betting/match/esport/magic-vs-big-41554587');
  assert.equal(url.searchParams.get('p'), 'g39d');
  assert.equal(url.searchParams.has('sub1'), false);
  assert.equal(url.searchParams.get('service'), 'prematch');
  assert.equal(new URL(buildOneWinMatchUrl({ ...event, serviceV2: 'live' })).searchParams.get('service'), 'live');
  assert.equal(buildOneWinMatchUrl({ ...event, slug: '//example.com/?p=other' }), null);
  assert.equal(new URL(buildOneWinMatchUrl({ ...event, sourceOrigin: 'https://one-vv9034.com' })).origin, 'https://one-vv9034.com');
  assert.equal(buildOneWinMatchUrl({ ...event, sourceOrigin: 'https://example.com' }), null);
});

test('follows a real mirror rotation without changing location or accepting arbitrary origins', async () => {
  const visited = [];
  const page = await readOneWinPage(async (url, options) => {
    visited.push(url.href);
    assert.equal(options.redirect, 'manual');
    return visited.length === 1
      ? new Response(null, { status: 301, headers: { location: 'https://one-vv9034.com/betting/esport/cs2-142?' } })
      : new Response('<html>public config</html>');
  });
  assert.equal(page.origin, 'https://one-vv9034.com');
  assert.equal(visited.length, 2);
  for (const location of ['http://one-vv9034.com/', 'https://example.com/', 'https://one-vv9034.com.evil.example/', 'https://one-vv9034.com:9000/', 'https://user:password@one-vv9034.com/']) {
    await assert.rejects(readOneWinPage(async () => new Response(null, { status: 302, headers: { location } })), /Untrusted/);
  }
  await assert.rejects(readOneWinPage(async () => new Response(null, { status: 301, headers: { location: 'https://one-vv9034.com/' } })), /Too many/);
});

async function request({ dbMatch = match, events = [event], source = freshSnapshot(), query = {}, country = 'AM', method = 'GET', throwSource = false } = {}) {
  const calls = [];
  const handler = createMatchOddsHandler({
    loadMatch: async id => { calls.push(['match', id]); return dbMatch; },
    loadEvents: async service => { calls.push(['events', service]); return events; },
    loadSnapshot: async id => { calls.push(['snapshot', id]); if (throwSource) throw new Error('source unavailable'); return source; },
    now: () => currentTime,
  });
  const response = {
    headers: {}, statusCode: 200,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
    redirect(code, url) { this.statusCode = code; this.location = url; return this; },
  };
  await handler({ method, headers: { 'x-vercel-ip-country': country }, query: { matchId: match.id, ...query } }, response);
  return { response, calls };
}

test('endpoint returns correctly oriented fresh odds without caching or external tracking', async () => {
  const { response, calls } = await request({ dbMatch: { ...match, team1_name: 'BIG', team2_name: 'magic' } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.odds.team1, { name: 'BIG', price: 1.8 });
  assert.deepEqual(response.body.odds.team2, { name: 'magic', price: 1.9 });
  assert.equal(response.body.odds.validForMs, 20_000);
  assert.match(response.body.odds.href, /^\/api\/match-odds\?matchId=1-.*&action=visit$/);
  for (const header of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) assert.match(response.headers[header], /no-store/);
  assert.equal(calls[1][1], 'prematch');
});

test('the actual DNK match endpoint exposes fresh LPH prices and links to the verified bookmaker event', async () => {
  const { response } = await request({ dbMatch: dnkMatch, events: [dnkFixture.event],
    source: { data: dnkFixture.snapshot, fetchedAt: currentTime }, query: { matchId: dnkMatch.id } });
  assert.equal(response.body.odds.matchId, dnkMatch.id);
  assert.equal(response.body.odds.eventId, 42108768);
  assert.deepEqual(response.body.odds.team1, { name: 'DNK', price: 3.2 });
  assert.deepEqual(response.body.odds.team2, { name: 'LPH Gaming', price: 1.3 });
  const visit = await request({ dbMatch: dnkMatch, events: [dnkFixture.event],
    source: { data: dnkFixture.snapshot, fetchedAt: currentTime }, query: { matchId: dnkMatch.id, action: 'visit' } });
  const target = new URL(visit.response.location);
  assert.equal(target.pathname, '/betting/match/esport/dnk-vs-lph-42108768');
  assert.equal(target.searchParams.get('p'), 'g39d');
});

test('geographic policy is checked before database or source reads', async () => {
  for (const country of ['RU', '', 'XX', undefined]) {
    const { response, calls } = await request({ country: country ?? '' });
    assert.deepEqual(response.body, { odds: null });
    assert.deepEqual(calls, []);
  }
});

test('invalid methods and identifiers never reach the source', async () => {
  for (const options of [{ method: 'POST' }, { query: { matchId: 'not-a-faceit-id' } }, { query: { matchId: [match.id] } }, { query: { action: 'unsafe' } }]) {
    const { response, calls } = await request(options);
    assert.ok([400, 405].includes(response.statusCode));
    assert.deepEqual(calls, []);
  }
});

test('unknown, finished and unmatched matches hide odds and skip unnecessary source reads', async () => {
  for (const dbMatch of [null, { ...match, status: 'FINISHED' }]) {
    const { response, calls } = await request({ dbMatch });
    assert.deepEqual(response.body, { odds: null });
    assert.equal(calls.length, 1);
  }
  const { response, calls } = await request({ events: [] });
  assert.deepEqual(response.body, { odds: null });
  assert.equal(calls.length, 2);
});

test('live pages use the live feed', async () => {
  const { response, calls } = await request({ dbMatch: { ...match, status: 'ONGOING' }, events: [{ ...event, serviceV2: 'live' }] });
  assert.equal(calls[1][1], 'live');
  assert.equal(response.body.odds.live, true);
});

test('stale, future or missing receipt times cannot show odds or redirect', async () => {
  for (const fetchedAt of [currentTime - 20_000, currentTime - 90_000, currentTime + 1, undefined, NaN]) {
    for (const action of [undefined, 'visit']) {
      const { response } = await request({ source: { data: snapshot, fetchedAt }, query: { action } });
      assert.deepEqual(response.body, { odds: null });
      assert.equal(response.location, undefined);
    }
  }
});

test('source failure, empty snapshot and suspended market hide the block', async () => {
  const suspended = freshSnapshot();
  suspended.data.oddsGroups[0].oddsList[0].status = 2;
  for (const options of [{ throwSource: true }, { source: { data: null, fetchedAt: currentTime } }, { source: suspended }]) {
    const { response } = await request(options);
    assert.deepEqual(response.body, { odds: null });
  }
});

test('visit revalidates the exact market and cannot override the affiliate or destination', async () => {
  const { response, calls } = await request({ query: { action: 'visit', p: '4drx', url: 'https://example.com', sub1: 'sni61' } });
  assert.equal(response.statusCode, 302);
  assert.equal(response.location, buildOneWinMatchUrl(event));
  assert.equal(calls.length, 3);
  const { response: missing } = await request({ events: [], query: { action: 'visit' } });
  assert.equal(missing.location, undefined);
});

class FakeWebSocket extends EventTarget {
  static latest;
  sent = [];
  closed = false;
  constructor(url) { super(); this.url = url; FakeWebSocket.latest = this; }
  send(value) { this.sent.push(value); }
  close() { this.closed = true; this.dispatchEvent(new Event('close')); }
  frame(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
}
const publicConfig = { apiUrl: 'https://api-gateway.top-parser.com', partnerId: '44ba10e5-7df2-47ab-a44d-dc93803c7a6e' };

test('public socket subscribes only to odds, answers heartbeat and closes after the requested snapshot', async () => {
  const pending = readOneWinSnapshot(publicConfig, event.id, { WebSocketImpl: FakeWebSocket });
  const socket = FakeWebSocket.latest;
  assert.equal(new URL(socket.url).protocol, 'wss:');
  assert.equal(new URL(socket.url).pathname, '/push-server-v2/');
  socket.frame('0{"sid":"public-test"}');
  socket.frame('40{"sid":"public-test"}');
  socket.frame('40{"sid":"duplicate"}');
  socket.frame('2');
  assert.deepEqual(socket.sent, ['40', `42${JSON.stringify(['subscribe', { messageType: 'subscribe-match-odds', data: { matchIds: [event.id], isBaseOddsGroups: true } }])}`, '3']);
  socket.frame(`42${JSON.stringify(['u', { messageType: 'match-odds-snapshot', data: { matchId: event.id + 1 } }])}`);
  assert.equal(socket.closed, false);
  socket.frame(`42${JSON.stringify(['u', { messageType: 'match-odds-snapshot', data: snapshot }])}`);
  assert.deepEqual(await pending, snapshot);
  assert.equal(socket.closed, true);
});

test('socket times out, rejects malformed data, and closes on provider errors', async () => {
  const timeout = readOneWinSnapshot(publicConfig, event.id, { WebSocketImpl: FakeWebSocket, timeoutMs: 5 });
  const timedSocket = FakeWebSocket.latest;
  await assert.rejects(timeout, /timed out/);
  assert.equal(timedSocket.closed, true);
  const malformed = readOneWinSnapshot(publicConfig, event.id, { WebSocketImpl: FakeWebSocket });
  FakeWebSocket.latest.frame('42not-json');
  await assert.rejects(malformed, /Invalid/);
  const error = readOneWinSnapshot(publicConfig, event.id, { WebSocketImpl: FakeWebSocket });
  FakeWebSocket.latest.dispatchEvent(new Event('error'));
  await assert.rejects(error, /connection failed/);
  assert.equal(FakeWebSocket.latest.closed, true);
});

test('socket handles unavailable markets and refuses an untrusted source', async () => {
  const pending = readOneWinSnapshot(publicConfig, event.id, { WebSocketImpl: FakeWebSocket });
  FakeWebSocket.latest.frame(`42${JSON.stringify(['u', { messageType: 'match-odds-snapshot', error: { matchId: event.id } }])}`);
  assert.equal(await pending, null);
  await assert.rejects(readOneWinSnapshot({ ...publicConfig, apiUrl: 'https://example.com' }, event.id), /Invalid odds source/);
});
