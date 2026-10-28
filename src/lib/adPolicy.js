// Share only in-flight and briefly fresh decisions. Never persist a country.
export function createAdPolicyLoader({ fetchImpl = (...args) => fetch(...args), now = Date.now } = {}) {
  let pending;
  let cached;
  let loadedAt = -Infinity;
  return function load({ force = false } = {}) {
    if (pending) return pending;
    if (!force && now() - loadedAt < 30000) return Promise.resolve(cached);
    pending = fetchImpl('/api/ad-policy', {
      cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(5000),
    }).then(response => response.ok ? response.json() : null).catch(() => null)
      .then(value => { cached = value; loadedAt = now(); return value; })
      .finally(() => { pending = null; });
    return pending;
  };
}
export const loadAdPolicy = createAdPolicyLoader();
const listeners = new Set();
let stopWatching;

export function subscribeAdPolicy(listener) {
  listeners.add(listener);
  void loadAdPolicy().then(value => { if (listeners.has(listener)) listener(value); });
  if (!stopWatching) {
    const refresh = event => {
      if (document.visibilityState === 'hidden') return;
      // Hide the previous region's creative while checking the new connection.
      if (event) for (const notify of listeners) notify(null);
      void loadAdPolicy({ force: true }).then(value => {
        for (const notify of listeners) notify(value);
      });
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    stopWatching = () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
      stopWatching = null;
    };
  }
  return () => { listeners.delete(listener); if (!listeners.size) stopWatching?.(); };
}

export function isAdProviderEnabled(policy, provider) {
  if (provider === 'pari') return policy?.pariEnabled === true;
  if (provider === 'onewin') return policy?.adsEnabled === true;
  return false;
}
