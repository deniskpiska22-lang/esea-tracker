import { getSiteSeoMetadata } from '../src/utils/siteSeo.js';
import { escapeHtml, ORIGIN } from './profileSeo.js';
import { result } from './seoData.js';
const labels = [['/','Home'],['/rankings','Team rankings'],['/matches','Match schedule and results'],['/players','Player statistics'],['/calendar','Tournament calendar'],['/about','About ESEA Tracker'],['/media','Community media']];
export async function loadSiteMetadata(client, pathname) {
  const metadata = getSiteSeoMetadata(pathname);
  let body = `<nav aria-label="Site pages"><ul>${labels.filter(([url])=>url!==pathname).map(([url,label])=>`<li><a href="${url}">${label}</a></li>`).join('')}</ul></nav>`;
  if (pathname==='/' || pathname==='/rankings') {
    const rows = await result(client.from('team_catalog').select('team_id,team').order('team_id').limit(60));
    body += `<h2>Explore ESEA CS2 teams</h2><ul>${rows.filter(row=>row.team?.slug && row.team?.name).map(({team})=>`<li><a data-entity-link="true" href="/teams/${encodeURIComponent(team.slug)}">${escapeHtml(team.name)}</a>${team.division ? ` — ${escapeHtml(team.division)}` : ''}</li>`).join('')}</ul>`;
  }
  if (pathname==='/' || pathname==='/matches') {
    const rows = await result(client.from('matches').select('id,team1_name,team1_score,team2_name,team2_score,competition_name,finished_at').in('status',['FINISHED','MATCH_STATUS_FINISHED']).order('finished_at',{ascending:false,nullsFirst:false}).limit(24));
    body += `<h2>Recent CS2 match results</h2><ul>${rows.map(m=>`<li><a data-entity-link="true" href="/match/${encodeURIComponent(m.id)}">${escapeHtml(m.team1_name)} ${escapeHtml(m.team1_score)}–${escapeHtml(m.team2_score)} ${escapeHtml(m.team2_name)}</a> — ${escapeHtml(m.competition_name)}</li>`).join('')}</ul>`;
  }
  if (pathname==='/players') {
    const urls = await result(client.from('seo_profile_urls').select('entity_id').eq('kind','players').order('position').limit(60));
    const rows = urls.length ? await result(client.from('players').select('faceit_id,nickname,country').in('faceit_id',urls.map(row=>row.entity_id))) : [];
    body += `<h2>Explore CS2 players</h2><ul>${rows.map(p=>`<li><a data-entity-link="true" href="/players/${encodeURIComponent(p.faceit_id)}">${escapeHtml(p.nickname)}</a>${p.country ? ` — ${escapeHtml(p.country)}` : ''}</li>`).join('')}</ul>`;
  }
  if (pathname==='/about') body += '<p>ESEA Tracker is an independent community project covering ESEA Counter-Strike 2 teams, players and matches. Explore tracked results, map statistics and team rankings across Europe and the Americas.</p>';
  return { ...metadata, body, canonicalUrl: ORIGIN+pathname };
}
