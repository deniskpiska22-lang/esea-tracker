import { faceitEloPatch } from '../scripts/lib/faceitPlayerProfile.js';
import { retryAfterMs } from '../scripts/lib/discoveryScan.js';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const ELO_COLUMNS = 'faceit_id,faceit_elo,faceit_level,faceit_profile_synced_at';
const DAY = 86400000;

export function playerEloIds(value) {
  const ids = [...new Set(String(value || '').split(',').map(id => id.trim().toLowerCase()))];
  return ids.length <= 10 && ids.every(id => UUID.test(id)) ? ids : null;
}

// A bounded, process-wide supplement to the background worker, never a proxy
// for arbitrary FACEIT accounts. Only existing database identities are loaded.
export function createEloRefresher({ db, apiKey, fetchImpl = fetch, now = Date.now,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const pending = new Map();
  let windowAt = now();
  let requests = 0;
  let cooldownUntil = 0;
  let nextRequestAt = 0;
  return function refresh(player) {
    const id = player.faceit_id;
    if (pending.has(id)) return pending.get(id);
    if (!apiKey || Number(player.faceit_elo) > 0 ||
      Date.parse(player.faceit_profile_synced_at) > now() - DAY) return Promise.resolve(null);
    if (now() - windowAt >= 60000) { windowAt = now(); requests = 0; }
    if (pending.size >= 2 || requests >= 60 || now() < cooldownUntil) return Promise.resolve(null);
    requests += 1;
    const delay = Math.max(0, nextRequestAt - now());
    nextRequestAt = Math.max(now(), nextRequestAt) + 500;
    const task = (async () => {
      try {
        if (delay) await wait(delay);
        if (now() < cooldownUntil) return null;
        const response = await fetchImpl(`https://open.faceit.com/data/v4/players/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(6000),
        });
        if ([401, 403, 429].includes(response.status)) {
          cooldownUntil = now() + Math.max(900000, retryAfterMs(response.headers.get('retry-after')));
          return null;
        }
        if (!response.ok && response.status !== 404) return null;
        const patch = response.status === 404 ? { faceit_profile_synced_at: new Date(now()).toISOString() }
          : faceitEloPatch(await response.json(), id, new Date(now()).toISOString());
        // Another writer may have filled the value while FACEIT responded.
        // Never replace that value or unrelated identity/roster fields.
        const { data, error } = await db.from('players').update(patch).eq('faceit_id', id)
          .or('faceit_elo.is.null,faceit_elo.lte.0').select(ELO_COLUMNS).maybeSingle();
        if (error) throw error;
        return data;
      } catch {
        // Keep the saved profile usable during provider/network outages.
        return null;
      } finally { pending.delete(id); }
    })();
    pending.set(id, task);
    return task;
  };
}

export function createPlayerEloHandler({ load, refresh, now = Date.now }) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET') return response.status(405).json({ ok: false });
    const ids = playerEloIds(request.query?.ids);
    if (!ids) return response.status(400).json({ ok: false, error: 'Use 1–10 FACEIT player IDs' });
    try {
      const players = await load(ids);
      const result = [];
      const started = now();
      for (const player of players) {
        const fresh = now() - started < 8000 ? await refresh(player) : null;
        const row = fresh || player;
        result.push({ faceit_id: player.faceit_id, faceit_elo: row.faceit_elo, faceit_level: row.faceit_level });
      }
      return response.status(200).json({ ok: true, players: result });
    } catch { return response.status(503).json({ ok: false, error: 'Player ELO temporarily unavailable' }); }
  };
}
