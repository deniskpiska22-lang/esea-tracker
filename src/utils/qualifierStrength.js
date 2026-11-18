import scheduledTournaments from '../../scripts/config/trackedTournaments.json' with { type: 'json' };
// Versioned crosswalk: the league leaders (~700 points) overlap HLTV #100–120.
// This is our rating policy, not HLTV's points or Valve's VRS.
export const QUALIFIER_POLICY_VERSION = 'hltv-crosswalk-v2-scheduled';
export const LEAGUE_CALIBRATION_TEAM_IDS = ['523a3f42-5446-4cf1-b131-b29b519e81bd', '053839e3-d2ff-40a1-998b-cd6c5c1e9083'];
export const QUALIFIER_REFERENCE = Object.freeze({ points: 700, rank: 110, slope: 160 });
export const isQualifierCompetition = (name) => /(?:qual(?:if|\b)|karsinta|квалиф)/i.test(String(name || ''));
export const coreIds = (roster) => [...new Set((roster || []).map(p => typeof p === 'string' ? p : p.player_id).filter(Boolean))];

export function rankOffset(rank) {
  const r = Number(rank);
  return Number.isInteger(r) && r > 0 ? QUALIFIER_REFERENCE.slope * Math.log2(QUALIFIER_REFERENCE.rank / r) : null;
}

export function rankToLeagueStrength(rank, anchorPoints = QUALIFIER_REFERENCE.points) {
  const offset = rankOffset(rank);
  return offset == null ? null : Math.round(Math.max(0, anchorPoints + offset));
}

// A weekly list's publication time is not provided. Activate the next UTC day,
// never apply a new Monday list to a match that preceded its publication.
export function rankingEffectiveAt(date) {
  return Date.parse(`${date}T00:00:00Z`) + 86400000;
}
export function snapshotAt(snapshots, at) {
  const time = typeof at === 'number' ? at : Date.parse(at);
  return snapshots.filter(s => rankingEffectiveAt(s.ranking_date) <= time &&
    time - rankingEffectiveAt(s.ranking_date) < 14 * 86400000)
    .sort((a,b) => b.ranking_date.localeCompare(a.ranking_date))[0] || null;
}

// Three distinct FACEIT accounts, verified through HLTV player profile links.
// Names alone, a copied team name, coaches and duplicate accounts cannot qualify.
export function findRankedCore(roster, snapshot) {
  const ids = new Set(coreIds(roster));
  if (ids.size < 3 || ids.size > 5 || !snapshot) return null;
  const matches = snapshot.teams.filter(team => {
    const linked = new Set(team.players.map(p => p.faceitId).filter(Boolean));
    return [...ids].filter(id => linked.has(id)).length >= 3;
  });
  return matches.length === 1 ? matches[0] : null;
}

export function calibrateLeagueAnchor(teams, rostersByTeam, snapshot) {
  if (!snapshot) return QUALIFIER_REFERENCE.points;
  const estimates = [];
  for (const team of teams) {
    if (!team.isCurrentTeam || team.matchesPlayed < 3) continue;
    const ranked = findRankedCore(rostersByTeam.get(team.teamId), snapshot);
    if (ranked && ranked.rank >= 80 && ranked.rank <= 150) estimates.push(team.points - rankOffset(ranked.rank));
  }
  if (estimates.length < 2) return QUALIFIER_REFERENCE.points;
  estimates.sort((a,b) => a-b);
  const mid = Math.floor(estimates.length / 2);
  const median = estimates.length % 2 ? estimates[mid] : (estimates[mid-1] + estimates[mid])/2;
  return Math.round(Math.max(450, Math.min(850, median)));
}

export function describeQualifierOpponent(team, roster, snapshot, anchorPoints) {
  // Internal league standings always take precedence over external lists.
  if (team.isLeagueTeam || team.isCurrentTeam) return { source: 'league', points: team.points };
  const ranked = findRankedCore(roster, snapshot);
  if (ranked) return { source: 'hltv', points: rankToLeagueStrength(ranked.rank, anchorPoints),
    rank: ranked.rank, hltvId: ranked.id, rankingDate: snapshot.ranking_date,
    anchorPoints, sourceUrl: snapshot.source_url };
  if (team.matchesPlayed >= 5) return { source: 'results', points: team.points };
  return { source: 'unrated', points: 275 };
}

export function qualifierRatingParameters(winnerStrength, loserStrength) {
  const strengths = [winnerStrength, loserStrength].filter(Boolean);
  const excess = Math.max(0, ...strengths.filter(s => s.source === 'hltv').map(s => s.points - s.anchorPoints));
  return {
    // Equal to our Advanced baseline around #110; progressively higher for
    // opponents above that level, even when normal Elo probability saturates.
    kFactor: Math.min(60, 26 * 2 ** (excess / 400)),
    confidence: strengths.some(s => s.source === 'unrated') ? 0.5 : 1,
  };
}

const eventName = value => String(value || '').toLowerCase().replace(/\s*\|?\s*prize:.*$/i,'').replace(/\s+/g,' ').trim();
const approvedIds = new Set(scheduledTournaments.map(t=>t.championshipId));
const approvedNames = new Set(scheduledTournaments.map(t=>eventName(t.name)));
export function usesNewQualifierPolicy(match) {
  if(!isQualifierCompetition(match?.competition_name))return false;
  const id=match?.rating_competition_id || match?.competition_id || match?.raw_data?.competition_id;
  // An existing championship cannot opt into the new policy by copying a name.
  if(id)return approvedIds.has(id);
  // Forecasts may only have the known event title, before a lobby is published.
  return approvedNames.has(eventName(match?.competition_name));
}
