import { getPlayerId } from './playerIdentity.js';

const EMPTY = Object.freeze([]);

function uniquePlayers(players) {
  const byId = new Map();
  for (const player of Array.isArray(players) ? players : EMPTY) {
    if (!player || typeof player !== 'object') continue;
    const id = getPlayerId(player);
    if (id && !byId.has(id)) byId.set(id, { ...player, faceit_id: id });
  }
  return [...byId.values()];
}

export function readMatchLineup(rawData, teamId) {
  let data = rawData;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = null; }
  }
  // Team identity is authoritative; similarly named teams cannot share players.
  const faction = teamId && Object.values(data?.teams || {}).find(team =>
    (team?.faction_id || team?.team_id) === teamId
  );
  return {
    matchRoster: uniquePlayers(faction?.roster),
    matchSubstitutes: uniquePlayers(faction?.substitutes),
  };
}

export function resolveMatchLineup(team, current) {
  const registered = [...current.starting, ...current.bench];
  const known = new Map([...registered, ...current.former].map(player => [getPlayerId(player), player]));
  const enrich = player => ({ ...known.get(getPlayerId(player)), ...player });
  const announced = uniquePlayers(team?.matchRoster);
  const substitutes = uniquePlayers(team?.matchSubstitutes);
  const oversized = announced.length > 5;
  const starting = announced.slice(0, 5).map(player => ({ ...enrich(player), lineupInferred: oversized }));
  const selected = new Set(starting.map(getPlayerId));
  const order = new Map(registered.map((player, index) => [getPlayerId(player), index]));

  // A partial FACEIT selection must not replace the other known players.
  // Prefer candidates actually named in this match's substitutes, ordered by
  // recent participation. These remain estimates until FACEIT names five.
  const candidates = (substitutes.length ? substitutes : uniquePlayers(registered.filter(player => player.isActive !== false)))
    .map(enrich)
    .sort((a, b) => (order.get(getPlayerId(a)) ?? registered.length) - (order.get(getPlayerId(b)) ?? registered.length));
  for (const player of candidates) {
    if (starting.length === 5) break;
    const id = getPlayerId(player);
    if (selected.has(id)) continue;
    selected.add(id);
    starting.push({ ...player, lineupInferred: true });
  }
  const inferredCount = starting.filter(player => player.lineupInferred).length;
  return {
    ...current,
    loading: announced.length === 0 && current.loading,
    pendingPlayers: current.loading && starting.length < 5,
    starting,
    announcedCount: oversized ? 0 : announced.length,
    inferredCount,
    provisional: announced.length !== 5,
    lineupSource: announced.length === 5 ? 'match_roster' : 'likely_lineup',
  };
}

export function formatLineupStat(value, decimals) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(decimals) : '—';
}
