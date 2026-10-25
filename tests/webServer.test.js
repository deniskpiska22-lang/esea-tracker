import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { request as httpRequest } from 'node:http';
import { gzipSync } from 'node:zlib';
import { createWebServer, requestCountry } from '../server/web.js';
import { compileRoute, resolveRewrite } from '../server/webRouting.js';
import adPolicy from '../api/ad-policy.js';

async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'esea-web-'));
  const dist = path.join(directory, 'dist');
  await mkdir(path.join(dist, 'assets'), { recursive: true });
  await writeFile(path.join(dist, 'index.html'), '<html>SPA entry</html>');
  const js = '/* public asset */'.repeat(200);
  await writeFile(path.join(dist, 'assets/app.js'), js);
  await writeFile(path.join(dist, 'assets/app.js.gz'), gzipSync(js));
  await writeFile(path.join(directory, 'private.txt'), 'secret');
  await symlink(path.join(directory, 'private.txt'), path.join(dist, 'leak.txt'));
  const server = createWebServer({ distDirectory: dist, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('route contract covers every localized section, optional forum slug, and sitemap pages', () => {
  for (const lang of ['en', 'de', 'pt', 'es', 'fr', 'it']) {
    for (const section of ['matches', 'stats', 'analytics', 'veto']) {
      assert.deepEqual(resolveRewrite(`/${lang}/teams/Name%20One/${section}`, '?period=3m&lang=ru').query, { period: '3m', lang, kind: 'team', key: 'Name One', section });
    }
  }
  assert.equal(resolveRewrite('/forum/topic/123', '').query.key, '123');
  assert.equal(resolveRewrite('/en/forum/topic/123/read-me', '').query.kind, 'forum');
  assert.deepEqual(resolveRewrite('/sitemaps/players-23.xml', '').query, { kind: 'players', page: '23' });
  assert.equal(resolveRewrite('/sitemaps/players-bad.xml', ''), null);
  assert.ok(compileRoute('/profile/:path*').test('/profile'));
  assert.ok(compileRoute('/profile/:path*').test('/profile/name/edit'));
});

test('SEO rewrites preserve filters and prevent query overriding the route identity', async t => {
  const base = await fixture(t, { handlers: { 'seo-profile': (req, res) => res.json(req.query) } });
  const result = await fetch(base + '/en/teams/Gremio/stats/nuke?kind=player&lang=ru&map=mirage&period=6m&opponent=A');
  assert.deepEqual(await result.json(), { kind: 'team-map', lang: 'en', map: 'nuke', period: '6m', opponent: 'A', key: 'Gremio' });
});

test('legacy and www redirects retain filters and never turn into cached pages', async t => {
  const base = await fixture(t, { handlers: { 'seo-profile': (req, res) => res.setHeader('Cache-Control', 's-maxage=60').json(req.query) } });
  let response = await fetch(base + '/en/team/squad/stats/nuke?period=3m', { redirect: 'manual' });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/en/teams/squad/stats/nuke?period=3m');
  // The client already sends the retired players directory home; direct visits
  // must behave the same instead of entering the unavailable SEO directory.
  for (const [pathname, destination] of [['/players', '/'], ['/en/players', '/en'], ['/de/players', '/de']]) {
    const directory = await fetch(base + pathname, { redirect: 'manual' });
    assert.equal(directory.status, 308);
    assert.equal(directory.headers.get('location'), destination);
  }
  await fetch(base + '/en');
  const location = await new Promise((resolve, reject) => {
    const req = httpRequest(base + '/en', { headers: { host: 'www.eseatracker.ru' } }, res => { res.resume(); resolve(res.headers.location); });
    req.on('error', reject); req.end();
  });
  assert.equal(location, 'https://eseatracker.ru/en');
});

test('static assets have correct MIME, gzip, ETag, immutable caching, HEAD and 304', async t => {
  const base = await fixture(t);
  const asset = await fetch(base + '/assets/app.js');
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal(asset.headers.get('content-encoding'), 'gzip');
  assert.match(asset.headers.get('cache-control'), /immutable/);
  assert.match(await asset.text(), /public asset/);
  const head = await fetch(base + '/assets/app.js', { method: 'HEAD' });
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('etag'), asset.headers.get('etag'));
  assert.equal((await fetch(base + '/assets/app.js', { headers: { 'if-none-match': asset.headers.get('etag') } })).status, 304);
  const plain = await fetch(base + '/assets/app.js', { headers: { 'accept-encoding': 'gzip;q=0' } });
  assert.equal(plain.headers.get('content-encoding'), null);
});

test('SPA fallback stays available; private paths, missing assets and APIs never expose source', async t => {
  const base = await fixture(t);
  assert.match(await (await fetch(base + '/en/login')).text(), /SPA entry/);
  assert.match((await fetch(base + '/en/admin')).headers.get('x-robots-tag'), /noindex/);
  for (const url of ['/api/unknown', '/assets/missing.js', '/server/web.js', '/.env', '/%2eenv', '/leak.txt', '/assets/%2e%2e%2f%2e%2e%2fprivate.txt']) {
    const response = await fetch(base + url);
    assert.equal(response.status, 404, url);
    assert.doesNotMatch(await response.text(), /secret|SPA entry/);
  }
  assert.deepEqual(await (await fetch(base + '/healthz')).json(), { ok: true });
});

test('JSON submissions enforce method, content type, body size, and malformed JSON', async t => {
  const base = await fixture(t, { handlers: { 'submit-team': (req, res) => res.json(req.body) } });
  const send = (body, type = 'application/json') => fetch(base + '/api/submit-team', { method: 'POST', headers: { 'content-type': type }, body });
  assert.deepEqual(await (await send('{"teamName":"test"}')).json(), { teamName: 'test' });
  assert.equal((await send('{bad')).status, 400);
  assert.equal((await send('text', 'text/plain')).status, 415);
  assert.equal((await send('x'.repeat(65537))).status, 413);
  assert.equal((await fetch(base + '/api/home-matches', { method: 'POST' })).status, 405);
});

test('public response cache expires, varies by query, and excludes auth and no-store responses', async t => {
  let time = 0, calls = 0;
  const base = await fixture(t, { now: () => time, handlers: {
    'home-matches': (req, res) => res.setHeader('Cache-Control', 'public, s-maxage=10').json({ calls: ++calls, query: req.query }),
    'ad-policy': (req, res) => res.setHeader('Cache-Control', 'private, no-store').json({ calls: ++calls }),
  } });
  const get = async (url = '/api/home-matches', options) => (await fetch(base + url, options)).json();
  assert.equal((await get()).calls, 1);
  assert.equal((await get()).calls, 1);
  assert.equal((await get('/api/home-matches?division=main')).calls, 2);
  assert.equal((await get('/api/home-matches', { headers: { authorization: 'Bearer example' } })).calls, 3);
  assert.equal((await get('/api/home-matches', { headers: { cookie: 'session=example' } })).calls, 4);
  assert.equal((await get()).calls, 1);
  time = 11000;
  assert.equal((await get()).calls, 5);
  assert.equal((await get('/api/ad-policy')).calls, 6);
  assert.equal((await get('/api/ad-policy')).calls, 7);
});

test('GEO policy uses only trusted Railway IP, ignores spoofed countries, and is never cached', async t => {
  const lookup = ip => ip === '1.2.3.4' ? { country: 'RU' } : ip === '5.6.7.8' ? { country: 'US' } : null;
  const base = await fixture(t, { handlers: { 'ad-policy': adPolicy }, geoOptions: { trustRailway: true, lookup } });
  const get = async ip => (await fetch(base + '/api/ad-policy', { headers: { 'x-real-ip': ip, 'x-vercel-ip-country': 'DE', 'cf-ipcountry': 'DE' } })).json();
  assert.deepEqual(await get('1.2.3.4'), { adsEnabled: false, pariEnabled: true, country: 'RU' });
  assert.deepEqual(await get('5.6.7.8'), { adsEnabled: true, pariEnabled: false, country: 'US' });
  assert.deepEqual(await get('invalid'), { adsEnabled: false, pariEnabled: false, country: null });
  assert.equal(requestCountry({ headers: { 'x-real-ip': '1.2.3.4' }, socket: { remoteAddress: '::ffff:5.6.7.8' } }, { trustRailway: false, lookup }), 'US');
});

test('network-path request targets are rejected without open redirects', async t => {
  const base = await fixture(t);
  const status = await new Promise((resolve, reject) => {
    const req = httpRequest(base, { path: '//evil.example/en' }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(status, 400);
});
