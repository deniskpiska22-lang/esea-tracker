import { findCatalogTeam } from './teamIdentity.js';

const indexes = new WeakMap();
function slugIndex(catalog) {
  if (!indexes.has(catalog)) indexes.set(catalog, new Map(catalog.map(team => [team.slug, team])));
  return indexes.get(catalog);
}

// Stored display fields can predate the ID-only importer. Never let a stale
// namesake slug carry another team's crest or profile into a match card.
export function resolveMatchTeam(catalog, team, rawData) {
  const id = team.id || team.faceitTeamId || null;
  const local = findCatalogTeam(catalog, id, team.name);
  const slugOwner = slugIndex(catalog).get(team.slug);
  const conflict = id && slugOwner && String(slugOwner.faceitTeamId) !== String(id);
  let raw = rawData;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  const factions = [...Object.values(raw?.teams || {}), ...(Array.isArray(raw?.factions) ? raw.factions : [])];
  const source = id && factions.find(faction =>
    String(faction?.premade_team_id || faction?.faction_id || faction?.team_id || faction?.id || '') === String(id));
  return {
    ...team,
    id,
    name: source?.name || source?.nickname || local?.name || team.name,
    slug: local?.slug || (conflict ? null : team.slug) || null,
    logo: source?.avatar || source?.logo || local?.logo || (conflict ? null : team.logo) || null,
  };
}

export function matchTeamSource(row) {
  return row.raw_data || { teams: [1, 2].map(side => ({
    faction_id: row[`source_team${side}_id`],
    avatar: row[`source_team${side}_logo`],
  })) };
}

export function normalizeFaceitFaction(catalog, faction = {}) {
  return resolveMatchTeam(catalog, {
    id: faction.premade_team_id || faction.faction_id || faction.team_id || faction.id || null,
    name: faction.name || faction.nickname || 'TBD',
    logo: faction.avatar || faction.logo || null,
  }, { teams: { faction } });
}
