const ORIGIN = 'https://eseatracker.ru';
export const MATCH_SEO_COLUMNS = 'id,status,best_of,competition_name,scheduled_at,started_at,finished_at,team1_id,team1_name,team1_score,team2_id,team2_name,team2_score,map_scores';
export const parseMaps = value => {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
export function getMatchSeoMetadata(match) {
  const first = match.team1_name || 'TBD';
  const second = match.team2_name || 'TBD';
  const competition = match.competition_name || 'ESEA CS2';
  const finished = ['FINISHED', 'MATCH_STATUS_FINISHED'].includes(match.status);
  const cancelled = /CANCELLED|CANCELED|ABORTED/.test(match.status || '');
  const live = /LIVE|ONGOING|PAUSED/.test(match.status || '');
  const date = match.scheduled_at || match.started_at || match.finished_at;
  const isoDate = date && !Number.isNaN(new Date(date).getTime()) ? new Date(date).toISOString() : null;
  const score = (finished || live) && match.team1_score != null && match.team2_score != null ? `${match.team1_score}–${match.team2_score}` : null;
  const label = finished ? 'Result' : live ? 'Live score' : cancelled ? 'Cancelled match' : 'Schedule';
  const canonicalPath = `/match/${encodeURIComponent(match.id)}`;
  const title = `${first} vs ${second}${score ? ` ${score}` : ''} — ${label} | ${competition}`;
  const description = `${first} vs ${second}${score ? `: ${score}` : ''} in ${competition}${isoDate ? ` on ${isoDate.slice(0, 10)}` : ''}${match.best_of ? ` (BO${match.best_of})` : ''}. CS2 ${finished ? 'match results' : live ? 'live match' : 'match schedule'}, maps and player statistics on ESEA Tracker.`;
  // SportsEvent requires a known date. Undated records use a WebPage instead.
  const event = isoDate ? { '@type': 'SportsEvent', '@id': `${ORIGIN}${canonicalPath}#match`, name: `${first} vs ${second}`, sport: 'Counter-Strike 2', startDate: isoDate, url: `${ORIGIN}${canonicalPath}`, description,
    eventStatus: cancelled ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    competitor: [first, second].map(name => ({ '@type': 'SportsTeam', name })),
    ...(finished && match.finished_at && !Number.isNaN(new Date(match.finished_at).getTime()) ? { endDate: new Date(match.finished_at).toISOString() } : {}),
  } : null;
  return { title, description, heading: `${first} vs ${second}${score ? ` — ${score}` : ''}`, canonicalPath, canonicalUrl: `${ORIGIN}${canonicalPath}`, language: 'en', robots: cancelled ? 'noindex,follow' : 'index,follow,max-image-preview:large',
    schema: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebPage', '@id': `${ORIGIN}${canonicalPath}#page`, url: `${ORIGIN}${canonicalPath}`, name: title, description, inLanguage: 'en', ...(event ? { mainEntity: { '@id': event['@id'] } } : {}) },
      ...(event ? [event] : []),
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ESEA Tracker', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: 'CS2 matches', item: ORIGIN + '/matches' },
        { '@type': 'ListItem', position: 3, name: `${first} vs ${second}`, item: ORIGIN + canonicalPath },
      ] },
    ] },
  };
}
