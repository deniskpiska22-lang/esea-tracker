import { linkedPlayerProfile } from '../data/linkedPlayerProfiles.js';

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

export function mergePeopleSearch(players, coaches, query, limit = 12) {
  const canonicalPlayers = new Map();
  for (const player of players) {
    const linked = linkedPlayerProfile(player.faceit_id || player.nickname);
    const item = linked ? { ...player, faceit_id: linked.id, nickname: linked.nickname } : player;
    const key = item.faceit_id || item.nickname.toLowerCase();
    if (!canonicalPlayers.has(key)) canonicalPlayers.set(key, item);
  }
  players = [...canonicalPlayers.values()];
  const coachingIds = new Set(coaches.map(coach => coach.id));
  const people = [
    ...coaches.map(coach => ({
      ...players.find(player => player.faceit_id === coach.id),
      nickname: coach.nickname, faceit_id: coach.id,
      playerNickname: coach.playerNickname,
      isCoach: true,
    })),
    ...players.filter(player => !coachingIds.has(player.faceit_id)),
  ];
  const priority = ({ nickname }) => {
    const key = nickname.toLowerCase();
    return key === query ? 0 : key.startsWith(query) ? 1 : 2;
  };
  return people.sort((a, b) => priority(a) - priority(b)).slice(0, limit);
}

export function searchPlayerRating(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? Number(value).toFixed(2) : null;
}
