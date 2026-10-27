import { matchPublicPath, readableMatchTeamName } from './matchUrls.js';
const ORIGIN = 'https://eseatracker.ru';
export const MATCH_SEO_COLUMNS = 'id,status,best_of,competition_name,scheduled_at,started_at,finished_at,team1_id,team1_name,team1_score,team2_id,team2_name,team2_score,map_scores';
export const parseMaps = value => {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
export function matchSeoRecord(source) {
  return {
    id: source.id || source.matchId,
    status: source.status || (source.date ? 'FINISHED' : 'SCHEDULED'),
    best_of: source.best_of ?? source.bestOf,
    competition_name: source.competition_name || source.season,
    scheduled_at: source.scheduled_at || source.scheduledAt || source.date,
    started_at: source.started_at || source.startedAt,
    finished_at: source.finished_at || source.finishedAt,
    team1_id: source.team1_id || source.team1?.id,
    team1_name: readableMatchTeamName(source.team1_name || source.team1?.name || source.teamName, source.team1_id || source.team1?.id, 'Team 1'),
    team1_score: source.team1_score ?? source.team1Score ?? source.team1?.score ?? source.teamScore,
    team2_id: source.team2_id || source.team2?.id,
    team2_name: readableMatchTeamName(source.team2_name || source.team2?.name || source.opponentName, source.team2_id || source.team2?.id, 'Team 2'),
    team2_score: source.team2_score ?? source.team2Score ?? source.team2?.score ?? source.opponentScore,
    map_scores: source.map_scores || source.mapScores,
  };
}
export function getMatchSeoMetadata(source) {
  const match = matchSeoRecord(source);
  const first = readableMatchTeamName(match.team1_name, match.team1_id, 'Team 1');
  const second = readableMatchTeamName(match.team2_name, match.team2_id, 'Team 2');
  const competition = match.competition_name || 'ESEA CS2';
  const finished = ['FINISHED', 'MATCH_STATUS_FINISHED'].includes(match.status);
  const cancelled = /CANCELLED|CANCELED|ABORTED/.test(match.status || '');
  const live = /LIVE|ONGOING|PAUSED/.test(match.status || '');
  const date = match.scheduled_at || match.started_at || match.finished_at;
  const isoDate = date && !Number.isNaN(new Date(date).getTime()) ? new Date(date).toISOString() : null;
  const score = (finished || live) && match.team1_score != null && match.team2_score != null ? `${match.team1_score}–${match.team2_score}` : null;
  const label = finished ? 'Result' : live ? 'Live score' : cancelled ? 'Cancelled match' : 'Schedule';
  const canonicalPath = matchPublicPath(match);
  const title = `${first} vs ${second}${score ? ` ${score}` : ''} — ${label} | ${competition}`;
  const description = `${first} vs ${second}${score ? `: ${score}` : ''} in ${competition}${isoDate ? ` on ${isoDate.slice(0, 10)}` : ''}${match.best_of ? ` (BO${match.best_of})` : ''}. CS2 ${finished ? 'match results' : live ? 'live match' : 'match schedule'}, maps and player statistics on ESEA Tracker.`;
  // Online matches are result pages, not physical events eligible for Google's
  // event listings. Describe the page and its teams without inventing a venue.
  return { title, description, matchEntity: match, heading: `${first} vs ${second}${score ? ` — ${score}` : ''}`, canonicalPath, canonicalUrl: `${ORIGIN}${canonicalPath}`, language: 'en', robots: cancelled ? 'noindex,follow' : 'index,follow,max-image-preview:large',
    schema: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebPage', '@id': `${ORIGIN}${canonicalPath}#page`, url: `${ORIGIN}${canonicalPath}`, name: title, description, inLanguage: 'en', about: [1,2].map(n => ({ '@type': 'SportsTeam', name: n === 1 ? first : second, ...(match[`team${n}_id`] ? { identifier: match[`team${n}_id`] } : {}) })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ESEA Tracker', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: 'CS2 matches', item: ORIGIN + '/matches' },
        { '@type': 'ListItem', position: 3, name: `${first} vs ${second}`, item: ORIGIN + canonicalPath },
      ] },
    ] },
  };
}
