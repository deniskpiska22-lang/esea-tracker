import { getPlayerSeoMetadata } from '../src/utils/playerSeo.js';
import aliases from '../src/data/playerAliases.js';
export const ORIGIN = 'https://eseatracker.ru';
export const staticRoutes = ['/', '/rankings', '/matches', '/players', '/calendar', '/about', '/media'];
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (url, name) => `<a href="${escapeHtml(url)}">${escapeHtml(name)}</a>`;
export function profileMetadata(kind, entity, roster = [], section = '') {
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
  const labels = { matches:'матчи и результаты', stats:'статистика', analytics:'аналитика', veto:'карты и вето' };
  const topic = labels[section] || 'матчи, состав, статистика и рейтинг';
  const canonicalPath = `/teams/${encodeURIComponent(entity.slug)}${section ? `/${section}` : ''}`;
  const description = `${entity.name} — ${topic} ESEA CS2.${entity.division ? ` Дивизион ${entity.division}.` : ''}${entity.season ? ` Сезон ${entity.season}.` : ''}`;
  const image = new URL(entity.logo || '/logo.png', ORIGIN).toString();
  return { title:`${entity.name}: ${topic} CS2 | ESEA Tracker`,description,image,canonicalPath,heading:`${entity.name} — команда ESEA CS2`,
    body: `<h2>Состав команды</h2>${roster.length ? `<ul>${roster.map(p => `<li>${link(`/players/${encodeURIComponent(p.faceit_id)}`,p.nickname)}</li>`).join('')}</ul>` : '<p>Состав пока не опубликован.</p>'}<p>${link(`${canonicalPath.split('/').slice(0,3).join('/')}/matches`, 'Матчи команды')}</p>`,
    schema:{'@context':'https://schema.org','@type':'SportsTeam',name:entity.name,sport:'Counter-Strike 2',url:`${ORIGIN}${canonicalPath}`,logo:image,description,
      athlete:roster.map(p => ({'@type':'Person',name:p.nickname,url:`${ORIGIN}/players/${encodeURIComponent(p.faceit_id)}`})) } };
}
export function renderProfile(template, metadata, status = 200) {
  const canonical = `${ORIGIN}${metadata.canonicalPath}`;
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(metadata.title)}</title>`);
  const metas = { 'name:description': metadata.description,'property:og:title':metadata.title,'property:og:description':metadata.description,
    'property:og:url':canonical,'property:og:image':new URL(metadata.image || '/logo.png',ORIGIN).toString(),
    'name:twitter:title':metadata.title,'name:twitter:description':metadata.description,'name:robots':status===404?'noindex,follow':'index,follow,max-image-preview:large' };
  for (const [key,value] of Object.entries(metas)) {
    const attr = key.slice(0,key.indexOf(':'));
    // OG names contain a colon; split only at the first separator.
    const metaName = key.slice(attr.length+1);
    const tag = `<meta ${attr}="${metaName}" content="${escapeHtml(value)}" />`;
    const regex = new RegExp(`<meta\\s+${attr}="${metaName}"\\s+content="[^"]*"\\s*\\/?>`,'i');
    html = regex.test(html) ? html.replace(regex,() => tag) : html.replace('</head>',() => `${tag}</head>`);
  }
  html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,() => `<link rel="canonical" href="${escapeHtml(canonical)}" />`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i,() => `<script type="application/ld+json">${JSON.stringify(metadata.schema || {}).replaceAll('<','\\u003c')}</script>`);
  return html.replace('<div id="root"></div>',() => `<div id="root"><main style="max-width:1000px;margin:auto;padding:32px"><h1>${escapeHtml(metadata.heading)}</h1><p>${escapeHtml(metadata.description)}</p>${metadata.body || ''}<nav>${link('/rankings','Команды ESEA')} · ${link('/players','Игроки ESEA')} · ${link('/matches','Матчи ESEA')}</nav></main></div>`);
}
export function sitemapXml(entries, index = false) {
  const tag = index ? 'sitemapindex' : 'urlset';
  return `<?xml version="1.0" encoding="UTF-8"?><${tag} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(e => `<${index?'sitemap':'url'}><loc>${escapeHtml(e.url)}</loc>${e.updatedAt ? `<lastmod>${escapeHtml(e.updatedAt)}</lastmod>` : ''}</${index?'sitemap':'url'}>`).join('')}</${tag}>`;
}
