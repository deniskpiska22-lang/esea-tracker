import { localizeBody, alternateLanguages } from '../src/i18n/seo.js';
import { LANGUAGES, localizedPath } from '../src/i18n/languages.js';
import { translateText } from '../src/i18n/translate.js';
import { getTeamSeoMetadata, getTeamContext } from '../src/utils/teamSeo.js';
import { getPlayerSeoMetadata } from '../src/utils/playerSeo.js';
import aliases from '../src/data/playerAliases.js';
import { getMatchSeoMetadata, parseMaps } from '../src/utils/matchSeo.js';
export const ORIGIN = 'https://eseatracker.ru';
export const staticRoutes = ['/', '/rankings', '/matches', '/players', '/calendar', '/about', '/media'];
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (url, name, preserve = true) => `<a ${preserve ? 'data-entity-link="true" ' : ''}href="${escapeHtml(url)}">${escapeHtml(name)}</a>`;
export function profileMetadata(kind, entity, roster = [], section = '', recentMatches = []) {
  if (kind === 'match') {
    const metadata = getMatchSeoMetadata(entity);
    const date = entity.scheduled_at || entity.started_at || entity.finished_at;
    const facts = [['Tournament',entity.competition_name],['Format',entity.best_of ? `BO${entity.best_of}` : null],['Status',entity.status],['Date (UTC)',date && !Number.isNaN(new Date(date).getTime()) ? new Date(date).toISOString() : null]];
    const teamLinks = roster.teams || [];
    const participants = roster.players || [];
    const maps = parseMaps(entity.map_scores);
    return { ...metadata, body: `<dl>${facts.filter(([,value])=>value).map(([label,value])=>`<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl>
      <h2>Teams</h2><ul>${[1,2].map(n=>{const team=teamLinks.find(t=>t.team_id===entity[`team${n}_id`])?.team;return `<li>${team?.slug ? link(`/teams/${encodeURIComponent(team.profileSlug || team.slug)}`,entity[`team${n}_name`] || team.name) : escapeHtml(entity[`team${n}_name`] || 'TBD')}</li>`;}).join('')}</ul>
      <h2>Map results</h2>${maps.length ? `<ul>${maps.map(map=>{const reversed=map.team1_id && map.team1_id===entity.team2_id;const one=reversed ? map.team2_score : map.team1_score ?? map.teamScore;const two=reversed ? map.team1_score : map.team2_score ?? map.opponentScore;return `<li>${escapeHtml(map.map || map.mapName || 'Map')}${one!=null && two!=null ? `: ${escapeHtml(one)}–${escapeHtml(two)}` : ''}</li>`;}).join('')}</ul>` : '<p>Map results are not available yet.</p>'}
      <h2>Player statistics</h2>${participants.length ? `<table><thead><tr><th>Player</th><th>Kills</th><th>Deaths</th><th>ADR</th><th>Rating</th></tr></thead><tbody>${participants.filter(p=>p.faceit_player_id && p.nickname).map(p=>`<tr><td>${link(`/players/${encodeURIComponent(p.nickname || p.faceit_player_id)}`,p.nickname)}</td>${[p.kills,p.deaths,p.adr,p.rating].map(v=>`<td>${escapeHtml(v ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p>Player statistics are not available yet.</p>'}` };
  }
  if (kind === 'player') {
    const metadata = getPlayerSeoMetadata(entity, aliases);
    const facts = [['Country',entity.country],['FACEIT Elo',entity.faceitElo],['FACEIT level',entity.faceitLevel],['Maps played',entity.mapsPlayed],['Matches played',entity.matchesPlayed],['Rating',entity.rating],['ADR',entity.adr],['K/D',entity.kd]];
    return { ...metadata, canonicalPath: new URL(metadata.canonicalUrl).pathname,
      heading: `${entity.nickname} — CS2 player statistics`,
      body: `${entity.teamName && entity.teamSlug ? `<p>Team: ${link(`/teams/${encodeURIComponent(entity.teamSlug)}`, entity.teamName)}</p>` : ''}
      ${metadata.aliases.length ? `<p>Aliases: ${metadata.aliases.map(escapeHtml).join(', ')}</p>` : ''}
      <dl>${facts.filter(([,v])=>v!=null && v!=='').map(([label,v])=>`<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
      <h2>Recent tracked matches</h2>${recentMatches.length ? `<ul>${recentMatches.map(match=>`<li>${link(`/match/${encodeURIComponent(match.id)}`,`${match.team1_name} vs ${match.team2_name}: ${match.team1_score}–${match.team2_score}`)}${match.competition_name ? ` — ${escapeHtml(match.competition_name)}` : ''}</li>`).join('')}</ul>` : '<p>Statistics will appear after the first tracked matches.</p>'}`,
      schema: { '@context':'https://schema.org', '@type':'Person', name:entity.nickname, identifier:entity.playerId,
        alternateName:metadata.aliases.length ? metadata.aliases : undefined, url:metadata.canonicalUrl,
        image:entity.avatar || undefined, nationality:entity.country || undefined,
        memberOf:entity.teamName && entity.teamSlug ? { '@type':'SportsTeam',name:entity.teamName,url:`${ORIGIN}/teams/${encodeURIComponent(entity.teamSlug)}` } : undefined } };
  }
  const metadata = getTeamSeoMetadata(entity, section, roster);
  const base = `/teams/${encodeURIComponent(entity.profileSlug || entity.slug)}`;
  const { division, region, country, season } = getTeamContext(entity);
  const facts = [['League', 'ESEA Counter-Strike 2'], ['Division', division], ['Region', region], ['Country', country], ['Season', season]]
    .filter(([, value]) => value).map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('');
  const members = roster.filter(player => player?.faceit_id && player?.nickname);
  const matches = recentMatches.filter(match => match.team1_id === entity.faceitTeamId || match.team2_id === entity.faceitTeamId);
  const matchRows = matches.map(match => {
    const first = match.team1_id === entity.faceitTeamId;
    const opponent = first ? match.team2_name : match.team1_name;
    const ownScore = first ? match.team1_score : match.team2_score;
    const otherScore = first ? match.team2_score : match.team1_score;
    const date = match.finished_at || match.scheduled_at;
    const validDate = date && !Number.isNaN(new Date(date).getTime());
    return `<li>${validDate ? `<time datetime="${escapeHtml(new Date(date).toISOString())}">${escapeHtml(new Date(date).toISOString().slice(0,10))}</time> — ` : ''}${link(`/match/${encodeURIComponent(match.id)}`, `${entity.name} vs ${opponent || 'Opponent'}${ownScore != null && otherScore != null ? `: ${ownScore}–${otherScore}` : ''}`)}${match.competition_name ? ` — ${escapeHtml(match.competition_name)}` : ''}</li>`;
  }).join('');
  const parseList = value => {
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  };
  const maps = new Map();
  const veto = new Map();
  for (const match of matches) {
    for (const map of parseList(match.map_scores)) {
      const name = String(map.map || map.mapName || '').replace(/^de_/, '');
      if (name) maps.set(name, (maps.get(name) || 0) + 1);
    }
    const recent = new Date(match.finished_at || match.scheduled_at).getTime() >= Date.now() - 90 * 86400000;
    if (!recent) continue;
    const faction = match.team1_id === entity.faceitTeamId ? 'faction1' : 'faction2';
    for (const step of parseList(match.veto_steps)) {
      if (step.selectedBy !== faction || !['pick', 'ban'].includes(String(step.action).toLowerCase())) continue;
      const name = String(step.map || '').replace(/^de_/, '');
      if (!name) continue;
      const counts = veto.get(name) || { picks: 0, bans: 0 };
      counts[String(step.action).toLowerCase() === 'pick' ? 'picks' : 'bans']++;
      veto.set(name, counts);
    }
  }
  const sectionContent = section === 'stats'
    ? `<h2>Maps in recent tracked matches</h2>${maps.size ? `<ul>${[...maps].map(([name, count]) => `<li>${link(`${base}/matches?map=${encodeURIComponent(name)}`, name)}: ${count} tracked map${count === 1 ? '' : 's'}</li>`).join('')}</ul><p>This sample covers the latest ${matches.length} completed matches. Open the map statistics page for the full tracked history.</p>` : '<p>Map results are not available yet.</p>'}`
    : section === 'veto'
    ? `<h2>Recent map picks and bans</h2>${veto.size ? `<ul>${[...veto].map(([name, counts]) => `<li>${escapeHtml(name)}: ${counts.picks} picks, ${counts.bans} bans</li>`).join('')}</ul><p>Team decisions from available veto records in the latest tracked matches within 90 days.</p>` : '<p>No recent team veto records are available yet.</p>'}`
    : '';
  return { ...metadata, body: `<p>${escapeHtml(metadata.intro)}</p><dl>${facts}</dl>
    <h2>${escapeHtml(entity.name)} CS2 roster</h2>${members.length ? `<ul>${members.map(player => `<li>${link(`/players/${encodeURIComponent(player.nickname || player.faceit_id)}`, player.nickname)}</li>`).join('')}</ul>` : '<p>No current roster has been published yet.</p>'}
    ${sectionContent}<h2>Recent ${escapeHtml(entity.name)} match results</h2>${matchRows ? `<ul>${matchRows}</ul>` : '<p>No completed matches are available yet.</p>'}
    <nav aria-label="Team sections">${[['', 'Overview'], ['/matches', 'All match results'], ['/stats', 'Map statistics'], ['/veto', 'Map picks and bans']].map(([path, label]) => link(`${base}${path}`, label, false)).join(' · ')}</nav>` };

}
export function renderProfile(template, metadata, status = 200) {
  const canonical = `${ORIGIN}${metadata.canonicalPath}`;
  let html = template.replace(/<html\b[^>]*>/i, () => `<html lang="${metadata.language || 'ru'}">`).replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(metadata.title)}</title>`);
  // Profile content is already readable: the generic loading overlay must not cover it.
  html = html.replace(/<div id="app-boot-shell"[^>]*>[\s\S]*?(?=<div id="root")/i, '');
  const metas = { 'name:description': metadata.description,'property:og:title':metadata.title,'property:og:description':metadata.description,
    'property:og:url':canonical,'property:og:image':metadata.image ? new URL(metadata.image,ORIGIN).toString() : '', 'name:twitter:image':metadata.image ? new URL(metadata.image,ORIGIN).toString() : '',
    'name:twitter:title':metadata.title,'name:twitter:description':metadata.description,'property:og:locale':LANGUAGES.find(item=>item.code===metadata.language)?.og || 'ru_RU', 'name:twitter:card':'summary', 'name:robots':status===404?'noindex,follow':metadata.robots || 'index,follow,max-image-preview:large' };
  for (const [key,value] of Object.entries(metas)) {
    const attr = key.slice(0,key.indexOf(':'));
    // OG names contain a colon; split only at the first separator.
    const metaName = key.slice(attr.length+1);
    if (!value) { html = html.replace(new RegExp(`<meta\\s+${attr}="${metaName}"[^>]*>`, 'gi'), ''); continue; }
    const tag = `<meta ${attr}="${metaName}" content="${escapeHtml(value)}" />`;
    const regex = new RegExp(`<meta\\s+${attr}="${metaName}"\\s+content="[^"]*"\\s*\\/?>`,'i');
    html = regex.test(html) ? html.replace(regex,() => tag) : html.replace('</head>',() => `${tag}</head>`);
  }
  const canonicalTag = `<link rel="canonical" href="${escapeHtml(canonical)}" />`;
  const canonicalRegex = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i;
  html = canonicalRegex.test(html) ? html.replace(canonicalRegex, () => canonicalTag) : html.replace('</head>', () => `${canonicalTag}</head>`);
  html = html.replace(/<link\s+[^>]*hreflang=[^>]*>/gi, '');
  const alternates = metadata.alternates || (status===200 && !metadata.robots?.includes('noindex') ? alternateLanguages(metadata.canonicalPath) : []);
  html = html.replace('</head>', () => alternates.map(item => `<link rel="alternate" hreflang="${item.language}" href="${escapeHtml(item.url)}" />`).join('') + '</head>');
  const schemaTag = `<script type="application/ld+json">${JSON.stringify(metadata.schema || {}).replaceAll('<','\\u003c')}</script>`;
  const schemaRegex = /<script type="application\/ld\+json">[\s\S]*?<\/script>/i;
  html = schemaRegex.test(html) ? html.replace(schemaRegex, () => schemaTag) : html.replace('</head>', () => `${schemaTag}</head>`);

  const language = metadata.language || 'ru';
  const body = metadata.localized ? localizeBody(metadata.body, language) : metadata.body || ''; 
  const nav = [['/rankings','ESEA team rankings'],['/players','CS2 players'],['/calendar','ESEA tournaments']]
    .map(([url,label])=>link(metadata.localized ? localizedPath(url,language) : url,translateText(label,language))).join(' · ');
  const languageNav = `<nav aria-label="${escapeHtml(translateText('Language',language))}">${LANGUAGES.map(item=>link(localizedPath(metadata.canonicalPath,item.code),item.name)).join(' · ')}</nav>`;
  return html.replace('<div id="root"></div>',() => `<div id="root"><main style="max-width:1000px;margin:auto;padding:32px">${languageNav}<h1>${escapeHtml(metadata.heading)}</h1><p>${escapeHtml(metadata.description)}</p>${body}<nav>${nav}</nav></main></div>`);
}
export function sitemapXml(entries, index = false) {
  const tag = index ? 'sitemapindex' : 'urlset';
  return `<?xml version="1.0" encoding="UTF-8"?><${tag} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(e => `<${index?'sitemap':'url'}><loc>${escapeHtml(e.url)}</loc>${e.updatedAt ? `<lastmod>${escapeHtml(e.updatedAt)}</lastmod>` : ''}</${index?'sitemap':'url'}>`).join('')}</${tag}>`;
}
