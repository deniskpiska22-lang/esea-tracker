import { normalizeNickname } from '../../src/utils/normalizeNickname.js';
import { historyBucket } from '../../src/utils/historyBuckets.js';

export function playerHistoryKey(nickname) {
  return normalizeNickname(nickname).toLowerCase();
}

export function buildHistoryArchive(matches, stats) {
  const groups = Object.fromEntries(['teams', 'matches', 'stats', 'players'].map(kind => [kind, Object.create(null)]));
  const add = (kind, key, value, append = false) => {
    if (!key) return;
    const bucket = groups[kind][historyBucket(key)] ||= Object.create(null);
    if (append) (bucket[key] ||= []).push(value);
    else bucket[key] = value;
  };
  const matchesById = new Map();
  for (const match of matches) {
    const id = match.matchId || match.id;
    add('teams', match.teamSlug, match, true);
    add('matches', id, match, true);
    if (!matchesById.has(id)) matchesById.set(id, []);
    matchesById.get(id).push(match);
  }
  for (const [id, match] of Object.entries(stats)) {
    add('stats', id, match);
    const players = new Set((match.teams || []).flatMap(team => (team.players || []).map(p => playerHistoryKey(p.nickname))));
    for (const key of players) {
      // Player history only reads this player's stats, plus the opponent's
      // identity/score. Keep that exact information without nine other players.
      const projected = { ...match, teams: (match.teams || []).map(team => ({
        ...team, players: (team.players || []).filter(p => playerHistoryKey(p.nickname) === key),
      })) };
      add('players', key, { stats: projected, matches: matchesById.get(id) || [] }, true);
    }
  }
  const recent = [...matchesById.values()].map(rows => rows[0])
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 12);
  return { groups, recent };
}
