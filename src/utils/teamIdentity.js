// A known FACEIT ID is authoritative, even when the local catalog is stale.
export function findCatalogTeam(catalog, id, name) {
  if (id) {
    return catalog.find(team => String(team.faceitTeamId) === String(id)) || null;
  }
  const normalized = String(name || "").replace(/\s+/g, "").toLowerCase();
  if (!normalized) return null;
  const matches = catalog.filter(team =>
    String(team.name || "").replace(/\s+/g, "").toLowerCase() === normalized
  );
  return matches.length === 1 ? matches[0] : null;
}
