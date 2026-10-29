import { formatMapName } from "./formatMapName.js";

function toNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }

export function parseVetoSteps(payload, team1, team2) {
  const tickets = payload?.payload?.tickets || payload?.tickets;

  if (!Array.isArray(tickets)) {
    return [];
  }

  const mapTicket = tickets.find(
    (ticket) => ticket?.entity_type === "map"
  );

  const entities = mapTicket?.entities;

  if (!Array.isArray(entities)) {
    return [];
  }

  const sorted = entities
    .slice()
    .sort((a, b) => toNumber(a.round) - toNumber(b.round));

  // FACEIT still stamps the last remaining map with status "pick" and a
  // selected_by faction, as if a team chose it — but nobody did, it's just
  // whatever was left after every ban/pick. Always treat the highest-round
  // entry as the decider instead of trusting that attribution.
  const deciderIndex = sorted.length - 1;

  return sorted.map((entity, index) => ({
    map: formatMapName(entity.guid),
    action:
      index === deciderIndex
        ? "Decider"
        : entity.status === "pick"
          ? "Picked"
          : "Banned",
    team:
      index === deciderIndex
        ? null
        : entity.selected_by === "faction1"
          ? team1
          : entity.selected_by === "faction2"
            ? team2
            : null,
  }));
}


export function buildPickedTeamByMap(steps, team1, team2) {
  const lookup = new Map();

  steps
    .filter((step) => step.action === "Picked" || step.action === "Decider")
    .forEach((step) => {
      const key = step.map.toLowerCase();

      if (step.team === team1) {
        lookup.set(key, "team1");
      } else if (step.team === team2) {
        lookup.set(key, "team2");
      } else {
        lookup.set(key, "decider");
      }
    });

  return lookup;
}


export function buildExpectedMapOrder(steps) {
  return steps
    .filter((step) => step.action === "Picked" || step.action === "Decider")
    .map((step) => step.map);
}

export function normalizeMapKey(name) {
  return formatMapName(name).toLowerCase();
}

export function buildDisplayMaps(maps, expectedMapOrder) {
  const realMaps = Array.isArray(maps) ? maps : [];
  const realByKey = new Map(
    realMaps.map((map) => [normalizeMapKey(map.map), map])
  );

  if (expectedMapOrder.length === 0) {
    return realMaps;
  }

  const usedKeys = new Set();

  const merged = expectedMapOrder.map((mapName) => {
    const key = normalizeMapKey(mapName);
    const real = realByKey.get(key);

    usedKeys.add(key);

    if (real) {
      return real;
    }

    return { map: mapName, pending: true };
  });

  // Safety net: a real synced map the veto order didn't account for
  // (mismatch between veto data and match data) still gets shown.
  realMaps.forEach((map) => {
    const key = normalizeMapKey(map.map);

    if (!usedKeys.has(key)) {
      merged.push(map);
    }
  });

  return merged;
}

