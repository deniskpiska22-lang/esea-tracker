export const UPCOMING_DIVISIONS = ['Advanced', 'Main', 'Intermediate', 'Entry', 'Open10'];

function parseDivision(value) {
  const text = String(value || '');
  if (/\bopen[\s_-]*10\b/i.test(text)) return 'Open10';
  return UPCOMING_DIVISIONS.slice(0, -1).find(division =>
    new RegExp(`\\b${division}\\b${division === 'Main' ? '(?!\\s+event\\b)' : ''}`, 'i').test(text)
  ) || null;
}

export function upcomingDivision(match) {
  // Classify the competition the match belongs to. A team's current division
  // can differ from the division of an older fixture or an imported event.
  const competition = match.competitionName || match.competition_name || match.season;
  return parseDivision(competition) || parseDivision(match.division);
}

export function countUpcomingDivisions(matches) {
  const counts = Object.fromEntries(['All', ...UPCOMING_DIVISIONS].map(key => [key, 0]));
  counts.All = matches.length;
  for (const match of matches) {
    const division = upcomingDivision(match);
    if (division) counts[division] += 1;
  }
  return counts;
}

export function filterUpcomingDivision(matches, division) {
  return division === 'All' ? matches : matches.filter(match => upcomingDivision(match) === division);
}
