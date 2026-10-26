import { PRESENCE_INTERVAL_MS, VISITOR_ID, VISITOR_KEY, PULSE_KEY, trafficPath } from '../utils/siteTraffic.js';

// A browser-wide lock covers ID creation AND the pulse. It prevents independent
// windows/tabs from generating IDs or sending duplicate heartbeat requests.
export async function pulsePresence({ browser = window, document = browser.document, path, now = Date.now } = {}) {
  if (document.hidden || !trafficPath(path)) return false;
  const send = async () => {
    if (document.hidden) return false;
    let storage, visitorId, previous;
    try {
      storage = browser.localStorage;
      visitorId = storage.getItem(VISITOR_KEY);
      if (!VISITOR_ID.test(visitorId || '')) {
        visitorId = browser.crypto.randomUUID();
        storage.setItem(VISITOR_KEY, visitorId);
      }
      previous = Number(storage.getItem(PULSE_KEY));
    } catch { return false; } // Do not invent per-tab IDs when storage is denied.
    const time = now();
    if (previous > 0 && time >= previous && time - previous < PRESENCE_INTERVAL_MS) return false;
    const response = await browser.fetch('/api/site-presence', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Site-Presence': '1' },
      body: JSON.stringify({ visitorId, path: trafficPath(path) }),
      signal: browser.AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    storage.setItem(PULSE_KEY, String(now()));
    return true;
  };
  // Older browsers share the same persisted ID; backend upserts also deduplicate.
  return browser.navigator.locks ? browser.navigator.locks.request('esea-presence', send) : send();
}
