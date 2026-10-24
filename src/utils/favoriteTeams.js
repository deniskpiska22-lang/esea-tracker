import legacyTeamIds from '../data/legacyFavoriteTeams.json' with { type: 'json' };
import { findTeamByRoute } from './teamProfileUrls.js';
// Old profile preferences predate immutable-ID URLs. Resolve those exact historic
// slugs through their original FACEIT IDs; never guess a renamed team by name.
export function favoriteTeamByKey(teams, key) {
  if (!key) return null;
  return findTeamByRoute(teams, key) || (Object.hasOwn(legacyTeamIds, key) ? findTeamByRoute(teams, legacyTeamIds[key]) : null);
}
export function favoriteTeamKey(team, fallback = '') {
  return team?.faceitTeamId || team?.faceit_team_id || team?.slug || fallback;
}
