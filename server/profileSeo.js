import { getTeamSeoMetadata, getTeamContext } from '../src/utils/teamSeo.js';
import { getPlayerSeoMetadata } from '../src/utils/playerSeo.js';
import aliases from '../src/data/playerAliases.js';
export const ORIGIN = 'https://eseatracker.ru';
export const staticRoutes = ['/', '/rankings', '/matches', '/players', '/calendar', '/about', '/media'];
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (url, name) => `<a href="${escapeHtml(url)}">${escapeHtml(name)}</a>`;
export function profileMetadata(kind, entity, roster = [], section = '', recentMatches = []) {
  if (kind === 'player') {
    const metadata = getPlayerSeoMetadata(entity, aliases);
    return { ...metadata, canonicalPath: new URL(metadata.canonicalUrl).pathname,
      heading: `${entity.nickname} — игрок ESEA CS2`,
      body: `${entity.teamName ? `<p>Команда: ${link(`/teams/${encodeURIComponent(entity.teamSlug)}`, entity.teamName)}</p>` : ''}<p>${entity.mapsPlayed ? `Сыграно карт: ${escapeHtml(entity.mapsPlayed)}.` : 'Статистика появится после первых сыгранных матчей.'}</p>`,
      schema: { '@context':'https://schema.org', '@type':'Person', name:entity.nickname, identifier:entity.playerId,
        alternateName:metadata.aliases.length ? metadata.aliases : undefined, url:metadata.canonicalUrl,
        image:entity.avatar || undefined, nationality:entity.country || undefined,
        memberOf:entity.teamName ? { '@type':'SportsTeam',name:entity.teamName,url:`${ORIGIN}/teams/${encodeURIComponent(entity.teamSlug)}` } : undefined } };
  }
  const metadata = getTeamSeoMetadata(entity, section, roster);
  const base = `/teams/${encodeURIComponent(entity.slug)}`;
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
    <h2>${escapeHtml(entity.name)} CS2 roster</h2>${members.length ? `<ul>${members.map(player => `<li>${link(`/players/${encodeURIComponent(player.faceit_id)}`, player.nickname)}</li>`).join('')}</ul>` : '<p>No current roster has been published yet.</p>'}
    ${sectionContent}<h2>Recent ${escapeHtml(entity.name)} match results</h2>${matchRows ? `<ul>${matchRows}</ul>` : '<p>No completed matches are available yet.</p>'}
    <nav aria-label="Team sections">${[['', 'Overview'], ['/matches', 'All match results'], ['/stats', 'Map statistics'], ['/veto', 'Map picks and bans']].map(([path, label]) => link(`${base}${path}`, label)).join(' · ')}</nav>` };

}
export function renderProfile(template, metadata, status = 200) {
  const canonical = `${ORIGIN}${metadata.canonicalPath}`;
  let html = template.replace(/<html\b[^>]*>/i, () => `<html lang="${metadata.language || 'ru'}">`).replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(metadata.title)}</title>`);
  // Profile content is already readable: the generic loading overlay must not cover it.
  html = html.replace(/<div id="app-boot-shell"[^>]*>[\s\S]*?(?=<div id="root")/i, '');
  const metas = { 'name:description': metadata.description,'property:og:title':metadata.title,'property:og:description':metadata.description,
    'property:og:url':canonical,'property:og:image':metadata.image ? new URL(metadata.image,ORIGIN).toString() : '', 'name:twitter:image':metadata.image ? new URL(metadata.image,ORIGIN).toString() : '',
    'name:twitter:title':metadata.title,'name:twitter:description':metadata.description,'property:og:locale':metadata.language==='en'?'en_US':'ru_RU', 'name:twitter:card':'summary', 'name:robots':status===404?'noindex,follow':metadata.robots || 'index,follow,max-image-preview:large' };
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
  const schemaTag = `<script type="application/ld+json">${JSON.stringify(metadata.schema || {}).replaceAll('<','\\u003c')}</script>`;
  const schemaRegex = /<script type="application\/ld\+json">[\s\S]*?<\/script>/i;
  html = schemaRegex.test(html) ? html.replace(schemaRegex, () => schemaTag) : html.replace('</head>', () => `${schemaTag}</head>`);

  return html.replace('<div id="root"></div>',() => `<div id="root"><main style="max-width:1000px;margin:auto;padding:32px"><h1>${escapeHtml(metadata.heading)}</h1><p>${escapeHtml(metadata.description)}</p>${metadata.body || ''}<nav>${link('/rankings',metadata.language==='en'?'ESEA team rankings':'Команды ESEA')} · ${link('/players',metadata.language==='en'?'CS2 players':'Игроки ESEA')} · ${link('/calendar',metadata.language==='en'?'ESEA tournaments':'Турниры ESEA')}</nav></main></div>`);
}
export function sitemapXml(entries, index = false) {
  const tag = index ? 'sitemapindex' : 'urlset';
  return `<?xml version="1.0" encoding="UTF-8"?><${tag} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(e => `<${index?'sitemap':'url'}><loc>${escapeHtml(e.url)}</loc>${e.updatedAt ? `<lastmod>${escapeHtml(e.updatedAt)}</lastmod>` : ''}</${index?'sitemap':'url'}>`).join('')}</${tag}>`;
}
