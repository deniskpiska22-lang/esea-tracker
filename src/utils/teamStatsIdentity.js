import { findTeamByRoute } from './teamProfileUrls.js';

const FACEIT_TEAM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Match history must also work before a newly discovered team reaches the
// catalog. Never substitute a namesake when the match provides a FACEIT ID.
export function resolveTeamStatsIdentity(teams, key) {
  if (!key) return null;
  return findTeamByRoute(teams, key) ||
    (FACEIT_TEAM_ID.test(key) ? { faceitTeamId: key } : null);
}
