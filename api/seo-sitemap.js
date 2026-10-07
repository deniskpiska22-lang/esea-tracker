import { teamSitemapEntries } from '../src/utils/teamSeo.js';
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
      const bounds=await Promise.all(["teams","players"].map(kind=>result(client.from("seo_profile_urls").select("position").eq("kind",kind).order("position",{ascending:false}).limit(1))));
      entries=bounds.flatMap((rows,i)=>Array.from({length:Math.max(1,Math.ceil((rows[0]?.position || 0)/PAGE_SIZE))},(_,p)=>({url:`${ORIGIN}/sitemaps/${i?'players':'teams'}-${p}.xml`})));
    } else {
      const rows=await result(client.from("seo_profile_urls").select("url,updated_at").eq("kind",kind).gt("position",page*PAGE_SIZE).lte("position",(page+1)*PAGE_SIZE).order("position"));
      entries=rows.flatMap(r=>kind==='teams' ? teamSitemapEntries(`${ORIGIN}${r.url}`,r.updated_at) : [{url:`${ORIGIN}${r.url}`,updatedAt:r.updated_at}]);
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
