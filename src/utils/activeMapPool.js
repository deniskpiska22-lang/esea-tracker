export const ACTIVE_MAP_POOL = [
  "Mirage",
  "Inferno",
  "Nuke",
  "Ancient",
  "Anubis",
  "Dust2",
  "Cache",
];

const ACTIVE_MAP_KEYS = new Set(
  ACTIVE_MAP_POOL.map((mapName) => normalizeMapKey(mapName))
);

export function normalizeMapKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^de_/, "")
    .replace(/[\s_-]+/g, "");
}

export function isActiveMap(value) {
  return ACTIVE_MAP_KEYS.has(normalizeMapKey(value));
}
