import test from 'node:test';
import assert from 'node:assert/strict';
import { profileMetadata, renderProfile, sitemapXml } from '../../server/profileSeo.js';
const template='<html><head><title>Default</title><meta name="description" content="default"><meta property="og:url" content="/"><link rel="canonical" href="/"><script type="application/ld+json">{}</script></head><body><div id="root"></div></body></html>';
const id='5d507112-1d7e-48cd-95c3-9e6bf2b0ac0e';
test('unrated player gets an indexable identity and team link',()=>{
 const m=profileMetadata('player',{playerId:id,nickname:'IthrowSky',teamName:'Are you READY',teamSlug:'are-you-ready-757c6914'});
 const html=renderProfile(template,m);
 assert.match(html,/<title>IthrowSky/);assert.match(html,/href="\/teams\/are-you-ready-757c6914"/);
 assert.match(html,new RegExp(`https://eseatracker.ru/players/${id}`));assert.doesNotMatch(m.description,/рейтинг 0|K\/D 0|ADR 0/);
 assert.equal(m.schema['@type'],'Person');
});
test('registered team renders crawlable roster links and structured data',()=>{
 const m=profileMetadata('team',{name:'K21',slug:'k21-48064213',division:'Open10',season:59,logo:'/logo.png'},[{faceit_id:id,nickname:'Player'}]);
 const html=renderProfile(template,m);assert.match(html,new RegExp(`href="/players/${id}"`));assert.equal(m.image,'https://eseatracker.ru/logo.png');assert.equal(m.schema['@graph'].find(node=>node['@type']==='SportsTeam').athlete.length,1);
});
test('untrusted nicknames cannot close scripts or inject HTML',()=>{
 const m=profileMetadata('player',{playerId:id,nickname:'</script><script>alert(1)</script> & " $&'});
 const html=renderProfile(template,m);assert.doesNotMatch(html,/<script>alert/);assert.match(html,/\\u003c\/script>/);assert.match(html,/\$&/);
});
test('unknown profiles are noindex and do not canonicalize to homepage',()=>{
 const html=renderProfile(template,{title:'Not found',heading:'Not found',description:'Not found',canonicalPath:'/players/missing'},404);
 assert.match(html,/noindex,follow/);assert.match(html,/https:\/\/eseatracker.ru\/players\/missing/);
});
test('sitemaps use real update dates and escape XML',()=>{
 const xml=sitemapXml([{url:'https://eseatracker.ru/teams/a&b',updatedAt:'2026-10-05T16:00:00Z'},{url:'https://eseatracker.ru/'}]);
 assert.match(xml,/a&amp;b/);assert.equal((xml.match(/<lastmod>/g)||[]).length,1);
});
