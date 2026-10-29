import { PRESENCE_INTERVAL_MS, VISITOR_ID, VISITOR_KEY, PULSE_KEY, trafficPath } from '../utils/siteTraffic.js';

const PAGE_PULSE_KEY = 'esea.presence.path.v1';

// A browser-wide lock covers ID creation AND the pulse. It prevents independent
// windows/tabs from generating IDs or sending duplicate heartbeat requests.
export async function pulsePresence({ browser = window, document = browser.document, path, viewEvent, now = Date.now } = {}) {
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
    if (!viewEvent && previous > 0 && time >= previous && time - previous < PRESENCE_INTERVAL_MS && storage.getItem(PAGE_PULSE_KEY) === trafficPath(path)) return false;
    const response = await browser.fetch('/api/site-presence', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Site-Presence': '1' },
      body: JSON.stringify({ visitorId, path: trafficPath(path), ...(viewEvent ? { viewEvent } : {}) }),
      signal: browser.AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    storage.setItem(PULSE_KEY, String(now()));
    storage.setItem(PAGE_PULSE_KEY, trafficPath(path));
    return true;
  };
  // Older browsers share the same persisted ID; backend upserts also deduplicate.
  return browser.navigator.locks ? browser.navigator.locks.request('esea-presence', send) : send();
}
