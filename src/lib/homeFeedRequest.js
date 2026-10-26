let pending;
let cached;
let cachedAt = 0;
export function requestHomeFeed() {
  if (cached && Date.now() - cachedAt < 10000) return Promise.resolve(cached);
  if (!pending) {
    pending = fetch('/api/home-matches?view=cards', { signal: AbortSignal.timeout(4500) })
      .then(async response => {
        if (!response.ok) throw new Error('Home feed unavailable');
        const payload = await response.json();
        if (!payload.ok || !Array.isArray(payload.rows)) throw new Error('Invalid home feed');
        cached = payload.rows;
        cachedAt = Date.now();
        return cached;
      }).finally(() => { pending = null; });
  }
  return pending;
}
