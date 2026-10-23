export function buildPlayerSearchIndex(teams, fallbackPlayers) {
  const byName = new Map();
  const add = player => {
    const key = String(player.nickname || '').toLowerCase();
    if (key && !byName.has(key)) byName.set(key, { ...player, searchKey: key });
  };
  for (const team of teams) {
    (team.players || []).forEach((nickname, index) => add({
      nickname, faceit_id: team.playerIds?.[index], team: team.name,
    }));
  }
  fallbackPlayers.forEach(add);
  return [...byName.values()];
}

export function searchPlayers(index, livePlayers, query, limit = 6) {
  if (!query) return [];
  const results = [], seen = new Set();
  for (const player of livePlayers) {
    const key = String(player.nickname || '').toLowerCase();
    if (player.query === query && key.includes(query) && !seen.has(key)) {
      results.push(player); seen.add(key);
      if (results.length === limit) return results;
    }
  }
  for (const player of index) {
    if (!seen.has(player.searchKey) && player.searchKey.includes(query)) {
      results.push(player); seen.add(player.searchKey);
      if (results.length === limit) break;
    }
  }
  return results;
}
