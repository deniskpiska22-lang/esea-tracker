import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createZstdDecompress } from 'node:zlib';

export function demoUrl(value, matchId) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!(url.hostname === 'demos.faceit.com' || /^demos-[a-z0-9-]+(?:\.backblaze)?\.faceit-cdn\.net$/.test(url.hostname)
      || /^demos-[a-z0-9-]+-faceit-cdn\.s3\.[a-z0-9-]+\.backblazeb2\.com$/.test(url.hostname))) return null;
    if (!url.pathname.includes(`/${matchId}-`) || !/\.dem(?:\.(?:zst|gz))?$/.test(url.pathname)) return null;
    return url;
  } catch { return null; }
}

export async function resolveDownloadUrl(resource, matchId, token, fetcher = fetch) {
  const url = demoUrl(resource, matchId);
  if (!url) throw new Error('Untrusted demo resource');
  // Data API / team-leagues return a logical, non-public resource URL.
  // Exchange it BEFORE attempting DNS/download, not just after an HTTP 403.
  if (url.hostname.endsWith('.backblazeb2.com')) return url.href;
  if (!token) throw Object.assign(new Error('FACEIT Downloads token is not configured'), { accessRequired: true });
  const response = await fetcher('https://api.faceit.com/download/v2/demos/download', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource_url: resource }), signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw Object.assign(new Error(`FACEIT Downloads HTTP ${response.status}`), { accessRequired: [401, 403].includes(response.status) });
  const data = await response.json();
  const signed = demoUrl(data.payload?.download_url, matchId);
  if (!signed || !signed.hostname.endsWith('.backblazeb2.com')) throw new Error('Untrusted signed demo URL');
  return signed.href;
}

const limited = maximum => {
  let size = 0;
  return new Transform({ transform(chunk, encoding, callback) { size += chunk.length; callback(size > maximum ? new Error('Demo exceeds size limit') : null, chunk); } });
};

export async function saveDemoResponse(response, destination, extension, signal) {
  if (!response.body) throw new Error('Empty demo response');
  if (Number(response.headers.get('content-length')) > 256 * 1024 * 1024) { await response.body.cancel(); throw new Error('Demo exceeds size limit'); }
  const decompress = extension.endsWith('.zst') ? createZstdDecompress() : extension.endsWith('.gz') ? createGunzip() : new Transform({ transform(c, e, cb) { cb(null, c); } });
  await pipeline(Readable.fromWeb(response.body), limited(256 * 1024 * 1024), decompress, limited(1024 * 1024 * 1024), createWriteStream(destination, { mode: 0o600 }), { signal });
}

export async function downloadDemo(value, matchId, destination, fetcher = fetch) {
  let url = demoUrl(value, matchId);
  if (!url) throw new Error('Untrusted demo resource');
  const signal = AbortSignal.timeout(120_000);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetcher(url, { signal, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = demoUrl(new URL(response.headers.get('location') || '', url).href, matchId);
      await response.body?.cancel();
      if (!next) throw new Error('Untrusted demo redirect');
      url = next; continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      const error = new Error(`Demo download HTTP ${response.status}`);
      error.accessRequired = [401, 403].includes(response.status);
      throw error;
    }
    await saveDemoResponse(response, destination, url.pathname, signal);
    return;
  }
  throw new Error('Too many demo redirects');
}

export async function resolveDemoUrls(match, apiKey, fetcher = fetch) {
  const list = value => Array.isArray(value) ? value : [];
  const urls = new Set([...list(match.demo_urls), ...list(match.raw_data?.demoURLs), ...list(match.raw_data?.demo_urls)].filter(value => demoUrl(value, match.id)));
  if (apiKey) {
    const response = await fetcher(`https://open.faceit.com/data/v4/matches/${encodeURIComponent(match.id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) { const data = await response.json(); for (const value of list(data.demo_url)) if (demoUrl(value, match.id)) urls.add(value); }
    else if (response.status === 429 || response.status >= 500) throw new Error(`Demo discovery HTTP ${response.status}`);
  }
  if (!urls.size) {
    const competition = match.raw_data?.competition_id || match.championship_id;
    if (competition) for (const teamId of [match.team1_id, match.team2_id]) {
      const query = new URLSearchParams({ championship_ids: competition, entityId: teamId, entityType: 'PREMADE_TEAM', status: 'MATCH_STATUS_FINISHED', offset: '0', limit: '20' });
      const response = await fetcher(`https://www.faceit.com/api/team-leagues/v2/matches?${query}`, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Demo discovery HTTP ${response.status}`);
      const data = await response.json();
      const room = Array.isArray(data.payload) ? data.payload.find(item => item.id === match.id) : null;
      for (const value of list(room?.demo_urls)) if (demoUrl(value, match.id)) urls.add(value);
      if (urls.size) break;
    }
  }
  return [...urls].filter(value => demoUrl(value, match.id)).slice(0, 5);
}

export function buildDemoContext(match) {
  const team = id => {
    const factions = Object.values(match.raw_data?.teams || {});
    const roster = factions.find(value => (value.faction_id || value.team_id) === id);
    const steamIds = [...new Set([...(roster?.roster || []), ...(roster?.substitutes || [])].map(p => String(p.game_player_id || '')).filter(id => /^7656\d{13}$/.test(id)))];
    if (steamIds.length < 3) throw new Error('Historical Steam roster is unavailable');
    return { id, steamIds };
  };
  const maps = (match.map_scores || []).flatMap(map => {
    const first = map.team1_id ? map.team1_id === match.team1_id : true;
    if ((map.team1_id || map.team2_id) && !((map.team1_id === match.team1_id && map.team2_id === match.team2_id)
      || (map.team1_id === match.team2_id && map.team2_id === match.team1_id))) return [];
    const a = map.team1_score, b = map.team2_score;
    if (![a, b].every(Number.isInteger) || Math.min(a, b) < 0 || Math.max(a, b) < 13 || map.pending || !map.map) return [];
    return [{ key: String(map.map).replace(/^de_/, '').toLowerCase(), score1: first ? a : b, score2: first ? b : a }];
  });
  if (!maps.length) throw new Error('No verified played maps');
  return { team1: team(match.team1_id), team2: team(match.team2_id), maps };
}
