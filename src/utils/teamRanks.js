import { findCatalogTeam } from "./teamIdentity.js";

export function buildTeamRanks(rows, catalog) {
  const ranked = rows.map(row => {
    const id = row.team_id ?? row.teamId ?? row.faceit_team_id ?? row.faceitTeamId ?? row.id;
    const name = row.team_name ?? row.name ?? row.teamName ?? "";
    const team = findCatalogTeam(catalog, id, name);
    const points = Number(row.points ?? row.rating ?? row.current_rating ?? row.currentRating ?? row.elo ?? row.score);
    return { id, team, name: name || team?.name || "Unknown team", points: Math.round(points) };
  }).filter(row => Number.isFinite(row.points));
  ranked.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "en"));
  const ranks = new Map();
  ranked.forEach((row, index) => {
    if (row.id) ranks.set(String(row.id), index + 1);
    if (row.team?.faceitTeamId) ranks.set(String(row.team.faceitTeamId), index + 1);
  });
  return ranks;
}
