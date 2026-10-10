export const TEAM_SITE_ORIGIN = 'https://eseatracker.ru';
export const TEAM_SECTIONS = ['matches', 'stats', 'veto'];
const REGION_SHORT = { Europe: 'EU', 'North America': 'NA', 'South America': 'SA', Oceania: 'OCE', Asia: 'Asia' };
const TOPICS = { '': 'Roster & Results', matches: 'Matches & Results', stats: 'Map Statistics', veto: 'Map Picks & Bans', analytics: 'Analytics' };

export function getTeamContext(team = {}) {
  const sources = Array.isArray(team.sources) ? team.sources : [];
  const latest = [...sources].sort((a, b) => Number(b.season || 0) - Number(a.season || 0));
  const season = team.season || latest[0]?.season;
  const relevant = latest.filter(source => !season || String(source.season) === String(season));
  const regions = [...new Set([team.region, ...relevant.map(source => source.region)].filter(Boolean))];
  const region = regions.join(' / ');
  const division = team.division || relevant[0]?.division || '';
  let country = '';
  const code = String(team.country || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(code) && !['XX', 'ZZ'].includes(code)) {
    try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || ''; } catch { /* Unknown country stays omitted. */ }
  }
  return { division, season, region, country, shortRegion: regions.map(value => REGION_SHORT[value] || value).join('/') };
}

export function getTeamIntro(team = {}) {
  const { division, season, region, country } = getTeamContext(team);
  const competition = ['ESEA', division, region].filter(Boolean).join(' ');
  const participation = team.activeSeasonParticipant === false ? 'has recorded participation in' : 'is tracked in';
  return `${team.name || 'This team'} is a Counter-Strike 2 (CS2) team${country ? ` from ${country}` : ''} and ${participation} ${competition}${season ? `, Season ${season}` : ''}. Follow its roster, match results, map statistics and team rating on ESEA Tracker.`;
}

export function getTeamSeoMetadata(team, section = '', roster = []) {
  const { division, region, country, shortRegion, season } = getTeamContext(team);
  const canonicalPath = `/teams/${encodeURIComponent(team.profileSlug || team.slug)}${section ? `/${section}` : ''}`;
  const canonicalUrl = `${TEAM_SITE_ORIGIN}${canonicalPath}`;
  const teamUrl = `${TEAM_SITE_ORIGIN}/teams/${encodeURIComponent(team.profileSlug || team.slug)}`;
  const competition = ['ESEA', division, shortRegion].filter(Boolean).join(' ');
  const topic = TOPICS[section] || TOPICS[''];
  const subjects = { '': 'roster, match results and team rating', matches: 'match results, opponents and match statistics', stats: 'map statistics and match history', veto: 'map picks, bans and veto history', analytics: 'team analytics' };
  const description = `${team.name} CS2 ${subjects[section] || subjects['']}. ${['ESEA', division, region, country, season ? `Season ${season}` : ''].filter(Boolean).join(' · ')}. Track the team on ESEA Tracker.`;
  let image;
  try {
    const candidate = team.logo ? new URL(team.logo, TEAM_SITE_ORIGIN) : null;
    if (candidate && ['http:', 'https:'].includes(candidate.protocol)) image = candidate.toString();
  } catch { /* No inherited image for an invalid team logo. */ }
  const members = roster.filter(player => player?.nickname && (player.faceit_id || player.playerId || player.faceitId));
  const teamSchema = { '@type': 'SportsTeam', '@id': `${teamUrl}#team`, name: team.name, sport: 'Counter-Strike 2', url: teamUrl,
    identifier: team.faceitTeamId || undefined, logo: image, description: getTeamIntro(team),
    location: country ? { '@type': 'Country', name: country } : undefined,
    athlete: members.length ? members.map(player => ({ '@type': 'Person', name: player.nickname, url: `${TEAM_SITE_ORIGIN}/players/${encodeURIComponent(player.faceit_id || player.playerId || player.faceitId)}` })) : undefined };
  const crumbs = [{ '@type': 'ListItem', position: 1, name: 'ESEA Tracker', item: TEAM_SITE_ORIGIN },
    { '@type': 'ListItem', position: 2, name: 'Team rankings', item: `${TEAM_SITE_ORIGIN}/rankings` },
    { '@type': 'ListItem', position: 3, name: team.name, item: teamUrl }];
  if (section) crumbs.push({ '@type': 'ListItem', position: 4, name: topic, item: canonicalUrl });
  return { title: `${team.name} CS2 — ${topic} | ${competition}`, description, canonicalPath, image,
    language: 'en', heading: `${team.name} — ${section ? topic : 'CS2 Team'}`, intro: getTeamIntro(team),
    robots: section === 'analytics' ? 'noindex,follow' : 'index,follow,max-image-preview:large',
    schema: { '@context': 'https://schema.org', '@graph': [teamSchema,
      { '@type': 'WebPage', '@id': `${canonicalUrl}#webpage`, url: canonicalUrl, name: `${team.name} — ${topic}`, description, inLanguage: 'en', mainEntity: { '@id': `${teamUrl}#team` } },
      { '@type': 'BreadcrumbList', itemListElement: crumbs }] } };
}

export function teamSitemapEntries(baseUrl, updatedAt) {
  return ['', ...TEAM_SECTIONS.map(section => `/${section}`)].map(suffix => ({ url: `${baseUrl}${suffix}`, updatedAt }));
}
