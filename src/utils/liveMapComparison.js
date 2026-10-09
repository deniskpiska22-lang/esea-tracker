import { ACTIVE_MAP_POOL, normalizeMapKey } from './activeMapPool.js';

export function normalizeLiveVeto(payload) {
  const tickets = payload?.payload?.tickets || payload?.tickets || [];
  const entities = tickets.find(ticket => ticket.entity_type === 'map')?.entities || [];
  const sorted = [...entities].sort((a, b) => Number(a.round) - Number(b.round));
  return sorted.map((entity, index) => ({
    map: entity.guid,
    action: index === sorted.length - 1 ? 'Decider' : entity.status === 'pick' ? 'Picked' : 'Banned',
    selectedBy: index === sorted.length - 1 ? null : entity.selected_by,
  }));
}

export function buildLiveMapComparison(matches = [], { now = Date.now(), excludeMatchId } = {}) {
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;
  const records = new Map(ACTIVE_MAP_POOL.map(name => [normalizeMapKey(name),
    { name, played: 0, wins: 0, picked: 0, banned: 0, vetoMatches: 0 }]));
  const seen = new Set();
  for (const match of matches) {
    const id = match.matchId || match.id;
    const time = new Date(match.date).getTime();
    if (!Number.isFinite(time) || time < cutoff || time > now ||
        (excludeMatchId && id === excludeMatchId) || (id && seen.has(id))) continue;
    if (id) seen.add(id);
    for (const map of match.mapScores || []) {
      const record = records.get(normalizeMapKey(map.map));
      const left = Number(map.teamScore), right = Number(map.opponentScore);
      // Unknown/tied results (including 0:0 placeholders) are not losses.
      if (!record || map.pending || !Number.isFinite(left) || !Number.isFinite(right) || left === right) continue;
      record.played++;
      record.wins += left > right ? 1 : 0;
    }
    const ownSteps = (match.vetoSteps || []).filter(step =>
      records.has(normalizeMapKey(step.map)) && step.side === 'team' &&
      ['Picked', 'Banned'].includes(step.action));
    if (!ownSteps.length) continue;
    for (const record of records.values()) record.vetoMatches++;
    for (const record of records.values()) {
      const steps = ownSteps.filter(step => normalizeMapKey(step.map) === normalizeMapKey(record.name));
      record.picked += steps.some(step => step.action === 'Picked') ? 1 : 0;
      record.banned += steps.some(step => step.action === 'Banned') ? 1 : 0;
    }
  }
  return [...records.values()].map(record => ({ ...record,
    win: record.played >= 3 ? Math.round(record.wins / record.played * 100) : null,
    pick: record.vetoMatches ? Math.round(record.picked / record.vetoMatches * 100) : null,
    ban: record.vetoMatches ? Math.round(record.banned / record.vetoMatches * 100) : null,
  }));
}
