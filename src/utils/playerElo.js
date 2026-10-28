const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const pending = new Map();

export async function loadMissingPlayerElo(players, fetchImpl = fetch) {
  const ids = [...new Set(players.filter(p => UUID.test(p?.faceit_id) && !(Number(p.faceit_elo) > 0))
    .map(p => p.faceit_id))];
  const patches = new Map();
  for (let from = 0; from < ids.length; from += 10) {
    const batch = ids.slice(from, from + 10);
    const key = [...batch].sort().join(',');
    if (!pending.has(key)) {
      const task = (async () => {
        try {
          const response = await fetchImpl(`/api/player-elo?ids=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20000) });
          if (!response.ok) return [];
          const data = await response.json();
          return data.ok && Array.isArray(data.players) ? data.players : [];
        } catch { return []; }
      })();
      pending.set(key, task);
      // Deduplicate navigation/StrictMode bursts; failed requests can retry later.
      const expiry = setTimeout(() => pending.delete(key), 60000);
      expiry.unref?.();
    }
    for (const row of await pending.get(key)) {
      if (!batch.includes(row?.faceit_id) || !Number.isInteger(row.faceit_elo) || row.faceit_elo <= 0) continue;
      const patch = { faceit_elo: row.faceit_elo };
      if (Number.isInteger(row.faceit_level) && row.faceit_level >= 1 && row.faceit_level <= 10) patch.faceit_level = row.faceit_level;
      patches.set(row.faceit_id, patch);
    }
  }
  return patches;
}
