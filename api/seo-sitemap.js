import { seoClient, result } from '../server/seoData.js';
import { ORIGIN, staticRoutes, sitemapXml } from '../server/profileSeo.js';
const PAGE_SIZE=1000;
export default async function handler(req,res) {
  const kind=String(req.query.kind || 'index');
  const page=Number(req.query.page || 0);
  if(!['index','teams','players'].includes(kind) || !Number.isInteger(page) || page<0 || page>10000) return res.status(404).end('Not found');
  try {
    const client=seoClient();
    let entries;
    if(kind==='index') {
      const counts=await result(client.rpc("seo_sitemap_counts"));
      entries=[counts.teams,counts.players].flatMap((count,i)=>Array.from({length:Math.max(1,Math.ceil(count/PAGE_SIZE))},(_,p)=>({url:`${ORIGIN}/sitemaps/${i?'players':'teams'}-${p}.xml`})));
    } else {
      const rows=await result(kind==='teams'?client.from('team_catalog').select('team,updated_at').order('team_id').range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1):client.from('players').select('faceit_id,nickname,updated_at').order('faceit_id').range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1));
      entries=rows.filter(r=>kind==='teams'?r.team?.slug:r.faceit_id && r.nickname).map(r=>({url:`${ORIGIN}/${kind}/${encodeURIComponent(kind==='teams'?r.team.slug:r.faceit_id)}`,updatedAt:r.updated_at}));
      if(kind==='teams' && page===0) entries.unshift(...staticRoutes.map(route=>({url:`${ORIGIN}${route}`})));
    }
    res.setHeader('Content-Type','application/xml; charset=utf-8');
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    return res.status(200).send(sitemapXml(entries,kind==='index'));
  } catch(error) {
    console.error('[seo-sitemap]',error.message);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Retry-After','60');
    return res.status(503).end('Sitemap temporarily unavailable');
  }
}
