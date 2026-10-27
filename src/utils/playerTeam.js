import { findCatalogTeam } from './teamIdentity.js';

// Match history identifies the team, but its old name and the build-time
// catalogue must never override the current catalogue entry with that ID.
export function resolvePlayerTeam(catalog, rosterTeam, latestMatch) {
  return (latestMatch && findCatalogTeam(catalog, latestMatch.teamId, latestMatch.teamName)) || rosterTeam || null;
}
