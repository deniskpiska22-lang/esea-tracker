import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pulsePresence } from '../src/lib/sitePresence.js';
import { trafficPath, VISITOR_KEY } from '../src/utils/siteTraffic.js';
import { createPresenceHandler } from '../api/site-presence.js';

function response() {
  return { code: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; return this; }, status(n) { this.code=n; return this; }, end() { return this; } };
}
function request(visitorId = randomUUID(), path = '/rankings') {
  return { method: 'POST', body: { visitorId, path }, headers: { host: 'eseatracker.ru', origin: 'https://eseatracker.ru', 'x-site-presence': '1', 'user-agent': 'Mozilla/5.0', 'x-vercel-ip-country': 'US' } };
}
function browserFixture() {
  const values = new Map();
  const requests = [];
  let queue = Promise.resolve();
  const browser = {
    document: { hidden: false }, crypto: { randomUUID }, AbortSignal,
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key,v) => values.set(key,v) },
    navigator: { locks: { request: (_name, callback) => { const next=queue.then(callback); queue=next.catch(()=>{}); return next; } } },
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true }; },
  };
  return { browser, requests, values };
}
test('five concurrent tabs share one stable browser ID and one heartbeat', async () => {
  const { browser, requests, values } = browserFixture();
  const now = () => 100000;
  await Promise.all(Array.from({ length: 5 }, (_,i) => pulsePresence({ browser, path: `/teams/team-${i}`, now })));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.visitorId, values.get(VISITOR_KEY));
  const id = values.get(VISITOR_KEY);
  await pulsePresence({ browser, path: '/matches', now: () => 121000 });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].body.visitorId, id);
  assert.equal(requests[1].body.path, '/matches');
});
test('hidden tabs and denied storage cannot create extra per-tab visitors', async () => {
  const { browser, requests } = browserFixture();
  browser.document.hidden = true;
  assert.equal(await pulsePresence({ browser, path: '/' }), false);
  browser.document.hidden = false;
  browser.localStorage.getItem = () => { throw new Error('Storage denied'); };
  assert.equal(await pulsePresence({ browser, path: '/' }), false);
  assert.equal(requests.length, 0);
});
test('failed pulses are retried; a future clock does not silence tracking forever', async () => {
  const { browser, requests } = browserFixture();
  const original = browser.fetch;
  browser.fetch = async () => ({ ok: false });
  await pulsePresence({ browser, path: '/', now: () => 100000 });
  browser.fetch = original;
  await pulsePresence({ browser, path: '/', now: () => 100000 });
  await pulsePresence({ browser, path: '/', now: () => 50000 });
  assert.equal(requests.length, 2);
});
test('traffic paths strip queries and reject sensitive, oversized and external paths', () => {
  assert.equal(trafficPath('/en/matches?token=secret#anchor'), '/en/matches');
  for (const path of ['/admin','/en/admin/thing','/login?token=secret','/profile/name','//evil.com','https://evil.com','/bad\\path','/x\n','/'+'x'.repeat(250),null]) assert.equal(trafficPath(path),null,String(path));
});
test('backend coalesces concurrent tab writes and never persists raw IDs or IPs', async () => {
  const records=[];
  let time=100000;
  const handler=createPresenceHandler({ record: async row => records.push(row), now:()=>time });
  const req=request();
  const results = await Promise.all(Array.from({ length: 5 }, () => handler(req,response())));
  assert.ok(results.every(res=>res.code===204));
  assert.equal(records.length,1);
  assert.match(records[0].p_visitor,/^[a-f0-9]{64}$/);
  assert.notEqual(records[0].p_visitor,req.body.visitorId);
  assert.deepEqual(Object.keys(records[0]),['p_visitor','p_path','p_country','p_device']);
  time+=20000;
  await handler(req,response());
  assert.equal(records.length,2);
});
test('method, origin, bot and validation checks run before any database writes', async () => {
  let records=0;
  const handler=createPresenceHandler({record:async()=>{records++;}});
  const get=request();get.method='GET';assert.equal((await handler(get,response())).code,405);
  const cross=request();cross.headers.origin='https://evil.com';assert.equal((await handler(cross,response())).code,403);
  const simple=request();delete simple.headers['x-site-presence'];assert.equal((await handler(simple,response())).code,403);
  const bot=request();bot.headers['user-agent']='Googlebot';assert.equal((await handler(bot,response())).code,204);
  assert.equal((await handler(request('fake-id'),response())).code,400);
  assert.equal((await handler(request(randomUUID(),'/de/admin'),response())).code,400);
  assert.equal(records,0);
});
test('database failure is visible to the tracker and does not poison coalescing', async () => {
  let calls=0;
  const handler=createPresenceHandler({record:async()=>{if(++calls===1)throw new Error('offline');}});
  const req=request();
  assert.equal((await handler(req,response())).code,503);
  assert.equal((await handler(req,response())).code,204);
  assert.equal(calls,2);
});
