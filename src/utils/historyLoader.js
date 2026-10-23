import { historyBucket } from './historyBuckets.js';

export function createHistoryLoader(base, fetcher = fetch, maxBuckets = 24) {
  const requests = new Map();
  function loadFile(path) {
    if (requests.has(path)) return requests.get(path);
    const pending = fetcher(base + path).then(response => {
      if (!response.ok) throw new Error(`History request failed: ${response.status}`);
      return response.json();
    }).catch(error => {
      if (requests.get(path) === pending) requests.delete(path);
      throw error;
    });
    requests.set(path, pending);
    // Bound memory when navigating across many teams/players in one session.
    if (requests.size > maxBuckets) requests.delete(requests.keys().next().value);
    return pending;
  }
  return {
    async load(kind, key) {
      if (!key) return null;
      const bucket = await loadFile(`${kind}/${historyBucket(key)}.json`);
      return bucket[key] || null;
    },
    recent() { return loadFile('recent.json'); },
  };
}
