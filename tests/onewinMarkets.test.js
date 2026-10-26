import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOneWinMarketUrl, extractOneWinMarket, isOpenCs2Market } from '../src/utils/onewinMarkets.js';
import { createMarketsHandler } from '../api/onewin-markets.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/onewin-markets-public.json', import.meta.url), 'utf8'));
const { event, snapshot } = fixture;
const currentTime = Date.parse(fixture.capturedAt);

test('the captured public CS2 question exposes the actual yes/no probabilities', () => {
  assert.equal(isOpenCs2Market(event, currentTime), true);
  assert.deepEqual(extractOneWinMarket(snapshot, event), { title: snapshot.oddsGroups[0].name, yes: 22, no: 78 });
});

test('Markets excludes expired events, other games, non-Markets events and invalid identities', () => {
  for (const patch of [
    { category: { slug: 'politics' } }, { tournament: { slug: 'league-of-legends' } },
    { sport: { sportType: 'esport' } }, { startAt: currentTime / 1000 - 1 },
    { endAt: currentTime / 1000 - 1 }, { serviceV2: 'finished' },
    { name: '' }, { name: 'x'.repeat(241) }, { slug: '../../evil' }, { id: -1 },
  ]) assert.equal(isOpenCs2Market({ ...event, ...patch }, currentTime), false);
});

test('binary Markets must have one exact question and two available complementary outcomes', () => {
  for (const change of [
    s => { s.matchId += 1; }, s => { s.blocked = true; },
    s => { s.oddsGroups.push(structuredClone(s.oddsGroups[0])); },
    s => { s.oddsGroups[0].name = ''; },
    s => { s.oddsGroups[0].blocked = true; },
    s => { s.oddsGroups[0].oddsList[0].status = 0; },
    s => { s.oddsGroups[0].oddsList[0].probability = NaN; },
    s => { s.oddsGroups[0].oddsList[0].probability = -1; },
    s => { s.oddsGroups[0].oddsList[0].probability = 60; },
    s => { s.oddsGroups[0].oddsList[0].outcome = 'no'; },
    s => { s.oddsGroups[0].oddsList[0].cf = 1; },
  ]) {
    const data = structuredClone(snapshot);
    change(data);
    assert.equal(extractOneWinMarket(data, event), null);
  }
});

test('a localized snapshot question stays bound by event ID when its feed translation uses synonyms', () => {
  const data = structuredClone(snapshot);
  data.oddsGroups[0].name = 'Valve ajoutera-t-il les trade-ups de stickers avant novembre ?';
  const translated = { ...event, name: 'Valve ajoutera-t-il les échanges de stickers avant novembre ?' };
  assert.equal(extractOneWinMarket(data, translated).title, data.oddsGroups[0].name);
  assert.equal(extractOneWinMarket({ ...data, matchId: event.id + 1 }, translated), null);
});

test('Markets links use the actual question route and preserve only the existing partner', () => {
  const url = new URL(buildOneWinMarketUrl(event));
  assert.equal(url.pathname, `/betting/markets/event/${event.slug}-${event.id}`);
  assert.equal(url.search, '?p=g39d');
  for (const sourceOrigin of ['https://evil.example', 'http://one-vv8346.com', 'https://user:pass@one-vv8346.com', 'https://one-vv8346.com:9999']) {
    assert.equal(buildOneWinMarketUrl({ ...event, sourceOrigin }), null);
  }
  assert.equal(buildOneWinMarketUrl({ ...event, slug: 'question?p=other' }), null);
});

async function request({ country = 'AM', method = 'GET', query = {}, events = [event], fetchedAt = currentTime, data = snapshot, fail = false } = {}) {
  const calls = [];
  const handler = createMarketsHandler({
    now: () => currentTime,
    loadEvents: async language => { calls.push(['events', language]); if (fail) throw Error('unavailable'); return events; },
    loadSnapshot: async (id, language) => { calls.push(['snapshot', id, language]); return { data, fetchedAt }; },
  });
  const res = {
    code: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; },
    end(body) { this.body = body; return this; }, redirect(code, href) { this.code = code; this.href = href; return this; },
  };
  await handler({ method, headers: { 'x-vercel-ip-country': country }, query }, res);
  return { ...res, calls };
}

test('fresh Markets response contains source title, probabilities, expiry and an internal click URL', async () => {
  const res = await request({ query: { lang: 'ru' } });
  assert.equal(res.code, 200);
  assert.equal(res.body.market.title, event.name);
  assert.equal(res.body.market.yes, 22);
  assert.equal(res.body.market.no, 78);
  assert.equal(res.body.market.validForMs, 60_000);
  assert.equal(res.body.market.href, `/api/onewin-markets?lang=ru&action=visit&eventId=${event.id}`);
  assert.deepEqual(res.calls, [['events', 'ru'], ['snapshot', event.id, 'ru']]);
  assert.match(res.headers['Cache-Control'], /private, no-store/);
});

test('every site language reaches both localized source calls without a cross-language cache result', async () => {
  for (const lang of ['ru', 'en', 'de', 'pt', 'es', 'fr', 'it']) {
    const res = await request({ query: { lang } });
    assert.equal(res.body.market.language, lang);
    assert.deepEqual(res.calls, [['events', lang], ['snapshot', event.id, lang]]);
  }
});

test('regional and invalid request checks happen before any public source reads', async () => {
  for (const country of ['RU', '', undefined, 'XX']) {
    const res = await request({ country: country || '' });
    assert.equal(res.body.market, null);
    assert.deepEqual(res.calls, []);
  }
  for (const options of [{ method: 'POST' }, { query: { lang: 'xx' } }, { query: { action: 'buy' } }, { query: { action: 'visit', eventId: 'bad' } }]) {
    const res = await request(options);
    assert.ok([400, 405].includes(res.code));
    assert.deepEqual(res.calls, []);
  }
});

test('stale, future, suspended, missing and unavailable sources leave the native fallback in place', async () => {
  for (const options of [
    { events: [] }, { fetchedAt: currentTime - 60_000 }, { fetchedAt: currentTime + 1 },
    { fetchedAt: NaN }, { data: null }, { fail: true },
    { events: [{ ...event, startAt: currentTime / 1000 - 1 }] },
  ]) assert.equal((await request(options)).body.market, null);
});

test('visits revalidate the chosen event and cannot override the destination or referral', async () => {
  const res = await request({ query: { action: 'visit', eventId: String(event.id), lang: 'en', url: 'https://evil.example', p: 'other' } });
  assert.equal(res.code, 302);
  assert.equal(res.href, buildOneWinMarketUrl(event));
  assert.equal((await request({ query: { action: 'visit', eventId: String(event.id + 1) } })).code, 503);
  assert.equal((await request({ query: { action: 'visit', eventId: String(event.id) }, fetchedAt: currentTime - 65_000 })).code, 503);
});
