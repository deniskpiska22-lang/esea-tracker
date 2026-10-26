import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import geoip from 'geoip-country';
import { redirects, headers, interpolate, resolveRewrite } from './webRouting.js';

const compress = promisify(gzip);
const API_NAMES = new Set(['ad-policy', 'home-matches', 'match', 'match-odds', 'onewin', 'onewin-markets', 'pari', 'ping', 'seo-profile', 'seo-sitemap', 'site-presence', 'submit-team', 'team-stats', 'test-db', 'veto']);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf' };
const MAX_BODY = 64 * 1024;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;

function acceptsGzip(req) {
  return (req.headers['accept-encoding'] || '').split(',').some(part => {
    const [encoding, quality] = part.trim().split(';');
    return encoding === 'gzip' && (!quality || Number(quality.trim().replace(/^q=/, '')) > 0);
  });
}

function responseAdapter(initialHeaders = {}) {
  return {
    statusCode: 200, headers: { 'cache-control': 'no-store', ...initialHeaders }, body: Buffer.alloc(0),
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.setHeader('Content-Type', 'application/json; charset=utf-8'); return this.send(JSON.stringify(value)); },
    send(value) { this.body = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? '')); return this; },
    end(value) { return this.send(value); },
    redirect(code, location) { if (typeof code === 'string') { location = code; code = 307; } this.status(code); this.setHeader('Location', location); return this.end(); },
  };
}

export function requestCountry(req, { trustRailway = Boolean(process.env.RAILWAY_ENVIRONMENT_ID), lookup = geoip.lookup } = {}) {
  // Railway's edge sets X-Real-IP. Never accept country headers supplied by a visitor.
  const address = trustRailway ? req.headers['x-real-ip'] : req.socket.remoteAddress;
  if (typeof address !== 'string') return '';
  const ip = address.startsWith('::ffff:') ? address.slice(7) : address;
  if (!isIP(ip)) return '';
  return lookup(ip)?.country || '';
}

async function parseBody(req) {
  if (Number(req.headers['content-length']) > MAX_BODY) throw Object.assign(new Error('Request too large'), { status: 413 });
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!bytes) return {};
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw Object.assign(new Error('Use application/json'), { status: 415 });
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

export function createWebServer({ distDirectory = path.resolve('dist'), handlers = {}, geoOptions = {}, now = Date.now } = {}) {
  const modules = new Map();
  const cache = new Map();
  let cachedBytes = 0;
  const distRoot = path.resolve(distDirectory);

  function cacheDelete(key) { const entry = cache.get(key); if (entry) cachedBytes -= entry.response.body.length; cache.delete(key); }
  function remember(key, response) {
    const control = response.headers['cache-control'] || '';
    const ttl = Number(control.match(/(?:^|,)\s*s-maxage=(\d+)/)?.[1]);
    // The existing home API includes ~6 MB of tracked match data. Allow it to
    // reuse its short public TTL while keeping the total cache bounded.
    if (!ttl || /private|no-store/i.test(control) || response.statusCode !== 200 || response.headers['set-cookie'] || response.headers.vary || response.body.length > 8 * 1024 * 1024) return;
    cacheDelete(key);
    cache.set(key, { response, expires: now() + ttl * 1000, created: now() });
    cachedBytes += response.body.length;
    while (cache.size > 128 || cachedBytes > MAX_CACHE_BYTES) cacheDelete(cache.keys().next().value);
  }

  async function api(name, req, query, initialHeaders) {
    const handler = handlers[name] || await (modules.get(name) || (() => {
      const loading = import(`../api/${name}.js`).then(module => module.default).catch(error => { modules.delete(name); throw error; });
      modules.set(name, loading); return loading;
    })());
    const output = responseAdapter(initialHeaders);
    const request = Object.assign(Object.create(req), { query, headers: { ...req.headers, 'x-vercel-ip-country': requestCountry(req, geoOptions) } });
    // Explicitly allow JSON submissions and anonymous presence pulses.
    request.method = req.method === 'HEAD' ? 'GET' : req.method;
    if (request.method === 'POST') request.body = await parseBody(req);
    await handler(request, output);
    return output;
  }

  async function staticFile(pathname, initialHeaders, req) {
    const decoded = decodeURIComponent(pathname);
    if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').some(part => part.startsWith('.'))) return null;
    const filename = path.resolve(distRoot, `.${decoded}`);
    if (!filename.startsWith(distRoot + path.sep)) return null;
    try {
      // Block symlinks leaving the public build directory as well as traversal.
      if (!(await realpath(filename)).startsWith(distRoot + path.sep)) return null;
      const info = await stat(filename);
      if (!info.isFile()) return null;
      const output = responseAdapter(initialHeaders);
      output.setHeader('Content-Type', MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream');
      if (!initialHeaders['cache-control']) output.setHeader('Cache-Control', path.extname(filename) === '.html' ? 'no-cache' : 'public, max-age=3600');
      output.setHeader('ETag', `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`);
      output.setHeader('Last-Modified', info.mtime.toUTCString());
      if (/\.(?:js|css|json|svg|xml|html|txt)$/.test(filename)) {
        output.setHeader('Vary', 'Accept-Encoding');
        if (acceptsGzip(req)) {
          try {
            output.body = await readFile(filename + '.gz');
            output.setHeader('Content-Encoding', 'gzip');
            return output;
          } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
      }
      output.body = await readFile(filename);
      return output;
    } catch (error) { if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) return null; throw error; }
  }

  async function route(req) {
    // Do not allow URL parsing to turn network-path references into another host.
    if (!req.url.startsWith('/') || req.url.startsWith('//')) return responseAdapter().status(400).end('Bad request');
    const url = new URL(req.url, 'http://internal');
    const pathname = url.pathname;
    const decodedPath = decodeURIComponent(pathname);
    if (decodedPath.includes('\0') || decodedPath.includes('\\') || decodedPath.split('/').some(part => part.startsWith('.'))) return responseAdapter().status(404).end('Not found');
    const initialHeaders = {};
    for (const route of headers) if (route.match.test(pathname)) for (const header of route.headers) initialHeaders[header.key.toLowerCase()] = header.value;
    for (const route of redirects) {
      const match = route.match.exec(pathname);
      if (!match || route.has?.some(condition => condition.type !== 'host' || req.headers.host?.split(':')[0] !== condition.value)) continue;
      const destination = new URL(interpolate(route.destination, match.groups), 'https://eseatracker.ru');
      for (const [key, value] of url.searchParams) if (!destination.searchParams.has(key)) destination.searchParams.append(key, value);
      return responseAdapter(initialHeaders).redirect(route.permanent ? 308 : 307, route.destination.startsWith('http') ? destination.href : destination.pathname + destination.search);
    }
    if (pathname === '/healthz') {
      try { await stat(path.join(distRoot, 'index.html')); return responseAdapter().json({ ok: true }); }
      catch { return responseAdapter().status(503).json({ ok: false }); }
    }
    if (pathname.startsWith('/api/')) {
      const name = pathname.slice(5).replace(/\/$/, '');
      if (!API_NAMES.has(name)) return responseAdapter().status(404).json({ error: 'Not found' });
      if (!['GET', 'HEAD'].includes(req.method) && !(['submit-team', 'site-presence'].includes(name) && req.method === 'POST')) return responseAdapter().status(405).setHeader('Allow', ['submit-team', 'site-presence'].includes(name) ? 'POST' : 'GET, HEAD').end('Method not allowed');
      return api(name, req, Object.fromEntries(url.searchParams), initialHeaders);
    }
    if (!['GET', 'HEAD'].includes(req.method)) return responseAdapter().status(405).setHeader('Allow', 'GET, HEAD').end('Method not allowed');
    const rewrite = resolveRewrite(pathname, url.search);
    if (rewrite) return api(rewrite.pathname.slice(5), req, rewrite.query, initialHeaders);
    const file = await staticFile(pathname, initialHeaders, req);
    if (file) return file;
    if (/^\/(?:assets|ads|_vercel)\//.test(pathname) || path.extname(pathname)) return responseAdapter().status(404).end('Not found');
    return await staticFile('/index.html', initialHeaders, req) || responseAdapter().status(503).end('Build unavailable');
  }

  const server = createServer(async (req, res) => {
    try {
      const eligible = req.method === 'GET' && !req.headers.authorization && !req.headers.cookie;
      const key = req.headers.host + req.url;
      let output;
      const entry = eligible && cache.get(key);
      if (entry && entry.expires > now()) output = { ...entry.response, headers: { ...entry.response.headers, age: Math.floor((now() - entry.created) / 1000) } };
      else {
        if (entry) cacheDelete(key);
        output = await route(req);
        if (eligible) remember(key, output);
      }
      const responseHeaders = { 'x-content-type-options': 'nosniff', ...output.headers };
      const body = output.body;
      if (output.statusCode === 200 && !responseHeaders.etag && !/no-store/i.test(responseHeaders['cache-control'])) responseHeaders.etag = `W/"${createHash('sha256').update(body).digest('base64url').slice(0, 24)}"`;
      if (['GET', 'HEAD'].includes(req.method) && output.statusCode === 200 && responseHeaders.etag && req.headers['if-none-match']?.split(/\s*,\s*/).includes(responseHeaders.etag)) {
        res.writeHead(304, responseHeaders); return res.end();
      }
      let payload = body;
      const compressible = /^(text\/|application\/(json|xml|javascript)|image\/svg)/.test(responseHeaders['content-type'] || '');
      if (compressible && !responseHeaders['content-encoding']) {
        responseHeaders.vary = [...new Set([...(responseHeaders.vary || '').split(',').map(value => value.trim()).filter(Boolean), 'Accept-Encoding'])].join(', ');
        if (body.length >= 1024 && acceptsGzip(req)) {
          output.gzipBody ||= await compress(body);
          payload = output.gzipBody; responseHeaders['content-encoding'] = 'gzip';
        }
      }
      responseHeaders['content-length'] = payload.length;
      res.writeHead(output.statusCode, responseHeaders);
      res.end(req.method === 'HEAD' ? undefined : payload);
    } catch (error) {
      if (res.headersSent) return res.end();
      const status = error.status || (error instanceof URIError ? 400 : 500);
      if (status >= 500) console.error('[web]', error.message);
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ error: status >= 500 ? 'Temporarily unavailable' : error.message }));
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  return server;
}
