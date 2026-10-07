import { readFile } from 'node:fs/promises';
import process from 'node:process';
import path from 'node:path';
import { seoClient, loadProfile } from '../server/seoData.js';
import { profileMetadata, renderProfile } from '../server/profileSeo.js';
import { loadSiteMetadata } from '../server/siteSeo.js';
import { pageMetadata } from '../src/utils/siteSeo.js';
let template;
export default async function handler(req,res) {
  const kind = ['player','team','match','page'].includes(req.query.kind) ? req.query.kind : 'team';
  const key = String(req.query.key || '');
  const section = String(req.query.section || '');
  if(!key || key.length>150 || (section && !['matches','stats','analytics','veto'].includes(section))) return res.status(404).end('Not found');
  try {
    template ||= await readFile(path.join(process.cwd(),'dist/index.html'),'utf8');
    if (kind==='page') {
      const pathname = key==='home' ? '/' : `/${key}`;
      if (!(pathname in pageMetadata)) return res.status(404).end('Not found');
      const metadata = await loadSiteMetadata(seoClient(),pathname);
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=60');
      return res.status(200).send(renderProfile(template,metadata));
    }
    const profile = await loadProfile(seoClient(),kind,key);
    if(!profile) {
      res.setHeader('Cache-Control','no-store');
      res.setHeader('X-Robots-Tag','noindex');
      return res.status(404).send(renderProfile(template,{title:'Профиль не найден | ESEA Tracker',description:'Этот профиль пока не найден.',heading:'Профиль не найден',canonicalPath:`/${kind==='team'?'teams':kind==='match'?'match':'players'}/${encodeURIComponent(key)}`},404));
    }
    const metadata = profileMetadata(kind,profile.entity,kind==='match' ? {players:profile.roster,teams:profile.teams} : profile.roster,section,profile.recentMatches);
    const requestedPath = kind==='match' ? `/match/${encodeURIComponent(key)}` : kind==='team'?`/teams/${encodeURIComponent(key)}${section?`/${section}`:''}`:`/players/${encodeURIComponent(key)}`;
    if(requestedPath!==metadata.canonicalPath) return res.redirect(308,metadata.canonicalPath);
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    return res.status(200).send(renderProfile(template,metadata));
  } catch(error) {
    console.error('[seo-profile]',error.message);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Retry-After','60');
    return res.status(503).end('Profile temporarily unavailable');
  }
}
