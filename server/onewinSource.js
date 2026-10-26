// Read-only public endpoints used by 1win's own sportsbook client.
// No user accounts, private tokens, country spoofing, or bet placement.
import { isOneWinSourceOrigin } from '../src/utils/onewinMatch.js';
import process from 'node:process';

const SOURCE = 'https://one-vv4852.com';
const ALLOWED_API = 'https://api-gateway.top-parser.com';
const memo = new Map();

function cached(key, ttl, read) {
  if (memo.size > 256) {
    for (const [name, entry] of memo) if (Date.now() >= entry.expiresAt) memo.delete(name);
    while (memo.size > 256) memo.delete(memo.keys().next().value);
  }
  const prior = memo.get(key);
  if (prior && Date.now() < prior.expiresAt) return prior.promise;
  const entry = { expiresAt: Infinity };
  entry.promise = Promise.resolve().then(read).then(value => {
    entry.expiresAt = Date.now() + ttl;
    return value;
  }, error => {
    entry.expiresAt = Date.now() + 5000;
    throw error;
  });
  memo.set(key, entry);
  return entry.promise;
}

async function readText(url, options = {}, source = 'source') {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`1win ${source} returned HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('1win source response is too large');
  return text;
}

// Mirrors rotate. Follow only redirects actually returned by the supplied
// public address, bounded to this provider's HTTPS mirror hosts.
export async function readOneWinPage(fetchImpl = fetch) {
  let url = new URL('/betting/esport/cs2-142', SOURCE);
  for (let hop = 0; hop < 3; hop += 1) {
    const response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('1win mirror redirect has no destination');
      const destination = new URL(location, url);
      if (!isOneWinSourceOrigin(destination.origin) || destination.username || destination.password) throw new Error('Untrusted 1win mirror redirect');
      await response.body?.cancel();
      url = destination;
      continue;
    }
    if (!response.ok) throw new Error(`1win configuration page returned HTTP ${response.status}`);
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error('1win source response is too large');
    return { html, origin: url.origin };
  }
  throw new Error('Too many 1win mirror redirects');
}

// These are public sportsbook client settings, not an account token or API
// secret. Railway can read the public feed without fetching the landing page
// on every cold start. Keep the API origin fixed and validate mirror hosts.
export function configuredOneWinSource(env) {
  const partnerId = env.ONEWIN_PUBLIC_PARTNER_ID?.trim();
  const sourceOrigin = env.ONEWIN_PUBLIC_SOURCE_ORIGIN?.trim();
  if (!partnerId && !sourceOrigin) return null;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(partnerId || '') || !isOneWinSourceOrigin(sourceOrigin)) {
    throw new Error('Invalid public 1win configuration');
  }
  return { apiUrl: ALLOWED_API, partnerId, sourceOrigin };
}

export function getOneWinConfig() {
  const configured = configuredOneWinSource(process.env);
  if (configured) return Promise.resolve(configured);
  return cached('config', 6 * 60 * 60_000, async () => {
    const { html, origin } = await readOneWinPage();
    const initial = html.match(/window\.INITIAL_DATA\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/);
    if (!initial) throw new Error('1win public configuration was not found');
    const settings = JSON.parse(initial[1]);
    const path = settings.sduiConfig?.templatesUrl;
    if (typeof path !== 'string' || !path.startsWith('/web/v2/sdui/templates/')) throw new Error('Invalid 1win template URL');
    const url = new URL(`/api${path}`, origin);
    if (url.origin !== origin) throw new Error('Invalid 1win template origin');
    const templates = JSON.parse(await readText(url, { headers: { 'Accept-Language': 'ru-RU', 'X-Origin': new URL(origin).host } }, 'configuration templates'));
    const config = templates.options?.moduleBetting?.find(item => item.name === 'Module_Betting')?.params;
    if (config?.apiUrl !== ALLOWED_API || !/^[a-f0-9-]{36}$/i.test(config.partnerId || '')) throw new Error('Unsupported 1win sportsbook configuration');
    return { apiUrl: config.apiUrl, partnerId: config.partnerId, sourceOrigin: origin };
  });
}

export function getOneWinEvents(service) {
  if (!['live', 'prematch'].includes(service)) throw new Error('Unsupported sportsbook service');
  return cached(`events:${service}`, 30_000, async () => {
    const config = await getOneWinConfig();
    const result = JSON.parse(await readText(`${config.apiUrl}/matches/get-many`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-lang': 'ru', 'x-external-partner-id': config.partnerId },
      body: JSON.stringify({ service, sportId: 142, includeSportType: 'esport', excludeSportType: 'polybet', limit: 100 }),
    }, 'event feed'));
    if (!Array.isArray(result.result?.items)) throw new Error('Invalid 1win event feed');
    // Do not silently match against an incomplete, capped feed.
    if (Number(result.result.meta?.total) > result.result.items.length) throw new Error('1win event feed exceeds the supported page size');
    return result.result.items.map(event => ({ ...event, sourceOrigin: config.sourceOrigin }));
  });
}

// The provider publishes odds through Socket.IO/Engine.IO snapshots. Only
// these few protocol messages are needed; close as soon as our snapshot arrives.
export function readOneWinSnapshot(config, matchId, { WebSocketImpl = WebSocket, timeoutMs = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.apiUrl);
    if (url.origin !== ALLOWED_API || !Number.isSafeInteger(matchId) || matchId <= 0) return reject(new Error('Invalid odds source'));
    url.protocol = 'wss:';
    url.pathname = '/push-server-v2/';
    url.search = new URLSearchParams({ Language: 'ru', externalPartnerId: config.partnerId, EIO: '4', transport: 'websocket' }).toString();
    const socket = new WebSocketImpl(url.href);
    let settled = false;
    let subscribed = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('1win odds snapshot timed out')), timeoutMs);
    socket.addEventListener('error', () => finish(new Error('1win odds connection failed')));
    socket.addEventListener('close', () => { if (!settled) finish(new Error('1win odds connection closed')); });
    socket.addEventListener('message', event => {
      try {
        const frame = String(event.data);
        if (frame.length > 1_000_000) return finish(new Error('1win odds snapshot is too large'));
        if (frame.startsWith('0')) socket.send('40');
        else if (frame === '2') socket.send('3');
        else if (frame.startsWith('40') && !subscribed) {
          subscribed = true;
          socket.send(`42${JSON.stringify(['subscribe', { messageType: 'subscribe-match-odds', data: { matchIds: [matchId], isBaseOddsGroups: true } }])}`);
        } else if (frame.startsWith('42')) {
          const [name, payload] = JSON.parse(frame.slice(2));
          if (name !== 'u' || payload?.messageType !== 'match-odds-snapshot') return;
          if (payload.error?.matchId === matchId) return finish(null, null);
          if (payload.data?.matchId === matchId) finish(null, payload.data);
        }
      } catch { finish(new Error('Invalid 1win odds message')); }
    });
  });
}

export function getOneWinSnapshot(matchId) {
  return cached(`odds:${matchId}`, 10_000, async () => {
    const data = await readOneWinSnapshot(await getOneWinConfig(), matchId);
    return { data, fetchedAt: Date.now() };
  });
}
