const REGIONS = {
  eu: 'Europe', europe: 'Europe',
  na: 'North America', northamerica: 'North America',
  sa: 'South America', southamerica: 'South America',
  oce: 'Oceania', oceania: 'Oceania', asia: 'Asia',
};

export function competitionDisplayName(value) {
  const name = String(value || 'ESEA League').normalize('NFKC').trim()
    .replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ');
  // Only the region in an ESEA season title is an alias. Names of cups and
  // qualifiers, as well as division/conference/stage suffixes, stay distinct.
  return name.replace(/^S(\d+)\s+(North America|South America|Europe|Oceania|Asia|EU|NA|SA|OCE)\b/i,
    (_, season, region) => `S${season} ${REGIONS[region.toLowerCase().replace(/\s/g, '')]}`);
}

function nameKey(value) {
  return competitionDisplayName(value).replace(/\s*-\s*/g, ' - ').toLowerCase();
}

export function groupCompetitionMatches(matches) {
  const idsByName = new Map();
  for (const match of matches) {
    const key = nameKey(match.season);
    if (!idsByName.has(key)) idsByName.set(key, new Set());
    if (match.competitionId) idsByName.get(key).add(match.competitionId);
  }

  const groups = new Map();
  for (const match of matches) {
    const normalizedName = nameKey(match.season);
    const knownIds = idsByName.get(normalizedName);
    // Older rows may have no championship ID. Attach them only when the
    // normalized name identifies a single championship in this list.
    const id = match.competitionId || (knownIds.size === 1 ? [...knownIds][0] : null);
    const key = id ? `championship:${id}` : `name:${normalizedName}`;
    if (!groups.has(key)) groups.set(key, {
      key, season: competitionDisplayName(match.season), matches: [],
    });
    groups.get(key).matches.push(match);
  }
  // Input order already expresses newest result / nearest fixture first.
  return [...groups.values()];
}
