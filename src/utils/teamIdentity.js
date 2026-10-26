const indexes = new WeakMap();
function catalogIndex(catalog) {
  let index = indexes.get(catalog);
  if (index) return index;
  index = { ids: new Map(), names: new Map() };
  for (const team of catalog) {
    const id = String(team.faceitTeamId);
    if (!index.ids.has(id)) index.ids.set(id, team);
    const name = String(team.name || '').replace(/\s+/g, '').toLowerCase();
    // A duplicate name remains ambiguous; never substitute a namesake.
    index.names.set(name, index.names.has(name) ? null : team);
  }
  indexes.set(catalog, index);
  return index;
}

// Catalog arrays are immutable snapshots; one index serves every card/rating.
export function findCatalogTeam(catalog, id, name) {
  const index = catalogIndex(catalog);
  if (id) return index.ids.get(String(id)) || null;
  const normalized = String(name || '').replace(/\s+/g, '').toLowerCase();
  return normalized ? index.names.get(normalized) || null : null;
}
