import { loadForumMetadata } from '../server/forumSeo.js';
import { localizeSeo } from '../src/i18n/seo.js';
import { translateText } from '../src/i18n/translate.js';
import { LANGUAGE_CODES, localizedPath } from '../src/i18n/languages.js';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import path from 'node:path';
import { seoClient, loadProfile } from '../server/seoData.js';
import { profileMetadata, renderProfile } from '../server/profileSeo.js';
import { loadSiteMetadata } from '../server/siteSeo.js';
import { pageMetadata } from '../src/utils/siteSeo.js';
import { loadTeamMapData } from '../server/teamMapData.js';
import { teamMapMetadata } from '../server/teamMapSeo.js';
import { mapName } from '../src/utils/teamMapStats.js';
let template;
export default async function handler(req,res) {
  const language = String(req.query.lang || 'ru');
  if (!LANGUAGE_CODES.includes(language)) return res.status(404).end('Not found');
  const kind = ['player','team','match','page','forum','team-map'].includes(req.query.kind) ? req.query.kind : 'team';
  const key = String(req.query.key || '');
  const section = String(req.query.section || '');
  if(!key || key.length>150 || (section && !['matches','stats','analytics','veto'].includes(section))) return res.status(404).end(translateText('Page not found',language));
  try {
    template ||= await readFile(path.join(process.cwd(),'dist/index.html'),'utf8');
    if (kind === 'team-map') {
      const map = mapName(req.query.map);
      if (!map) { res.setHeader('X-Robots-Tag', 'noindex'); return res.status(404).end(translateText('Map statistics not found', language)); }
      const data = await loadTeamMapData(seoClient(), key);
      if (!data) { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex'); return res.status(404).end(translateText('Map statistics not found', language)); }
      const metadata = teamMapMetadata(data, map, language);
      const requested = localizedPath(`/teams/${encodeURIComponent(key)}/stats/${encodeURIComponent(req.query.map)}`, language);
      if (requested !== metadata.canonicalPath) {
        const params = new URLSearchParams();
        for (const name of ['period','event','opponent','match']) if (typeof req.query[name] === 'string' && req.query[name].length <= 200) params.set(name, req.query[name]);
        return res.redirect(308, metadata.canonicalPath + (params.size ? `?${params}` : ''));
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
      return res.status(200).send(renderProfile(template, metadata));
    }
    if (kind==='forum') {
      const metadata=await loadForumMetadata(seoClient(),key,language);
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      if(!metadata){
        res.setHeader('X-Robots-Tag','noindex');
        return res.status(404).send(renderProfile(template,{title:translateText('Topic not found or unavailable.',language),heading:translateText('Topic not found or unavailable.',language),description:translateText('This page is unavailable.',language),canonicalPath:localizedPath(`/forum/topic/${key}`,language),language,robots:'noindex,follow',alternates:[]},404));
      }
      return res.status(200).send(renderProfile(template,metadata));
    }
    if (kind==='page') {
      const pathname = key==='home' ? '/' : `/${key}`;
      if (!(pathname in pageMetadata)) return res.status(404).end(translateText('Page not found',language));
      const metadata = localizeSeo(await loadSiteMetadata(seoClient(),pathname), language);
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=60');
      return res.status(200).send(renderProfile(template,metadata));
    }
    const profile = await loadProfile(seoClient(),kind,key);
    if(!profile) {
      res.setHeader('Cache-Control','no-store');
      res.setHeader('X-Robots-Tag','noindex');
      return res.status(404).send(renderProfile(template,localizeSeo({robots:'noindex,follow',title:'Профиль не найден | ESEA Tracker',description:'Этот профиль пока не найден.',heading:'Профиль не найден',canonicalPath:`/${kind==='team'?'teams':kind==='match'?'match':'players'}/${encodeURIComponent(key)}`},language),404));
    }
    const originalMetadata = profileMetadata(kind,profile.entity,kind==='match' ? {players:profile.roster,teams:profile.teams} : profile.roster,section,profile.recentMatches);
    const metadata = localizeSeo(originalMetadata, language, {kind,entity:profile.entity,section});
    if (originalMetadata.intro) metadata.body = metadata.body.replace(escapeIntro(originalMetadata.intro), escapeIntro(metadata.intro));
    if (kind==='team' && /^[a-z]{2}$/i.test(profile.entity.country || '')) {
      try {
        const code=profile.entity.country.toUpperCase();
        const english=new Intl.DisplayNames(['en'],{type:'region'}).of(code);
        const localized=new Intl.DisplayNames([language],{type:'region'}).of(code);
        metadata.body=metadata.body.replace(`<dd>${escapeIntro(english)}</dd>`,`<dd>${escapeIntro(localized)}</dd>`);
      } catch { /* Keep a supplied country name if the code is unknown. */ }
    }
    const requestedPath = kind==='match' ? `/match/${encodeURIComponent(key)}` : kind==='team'?`/teams/${encodeURIComponent(key)}${section?`/${section}`:''}`:`/players/${encodeURIComponent(key)}`;
    if(localizedPath(requestedPath,language)!==metadata.canonicalPath) return res.redirect(308,metadata.canonicalPath);
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    return res.status(200).send(renderProfile(template,metadata));
  } catch(error) {
    console.error('[seo-profile]',error.message);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Retry-After','60');
    return res.status(503).end(translateText('Could not complete the request. Please try again.',language));
  }
}

function escapeIntro(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
