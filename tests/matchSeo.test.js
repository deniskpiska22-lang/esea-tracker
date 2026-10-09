import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMatchSeoMetadata } from '../src/utils/matchSeo.js';
import { profileMetadata, renderProfile } from '../server/profileSeo.js';
import { getSiteSeoMetadata, pageMetadata } from '../src/utils/siteSeo.js';
const template='<html lang="ru"><head><title>Default</title><link rel="canonical" href="https://eseatracker.ru/"><script type="application/ld+json">{}</script></head><body><div id="root"></div></body></html>';
const match={id:'1-117a356c-a8f9-4c5d-a24a-3f8ef04d408b',status:'MATCH_STATUS_FINISHED',best_of:1,competition_name:'S58 EU Intermediate',scheduled_at:'2026-07-21T18:00:00Z',team1_id:'one',team1_name:'UK RIPPER',team1_score:11,team2_id:'two',team2_name:'CloudPeppers',team2_score:13,map_scores:[{map:'Ancient',teamScore:11,opponentScore:13}]};
test('reported duplicate match has its own canonical, title, scores and readable HTML',()=>{
 const metadata=profileMetadata('match',match,{teams:[{team_id:'one',team:{slug:'uk-ripper-one'}}],players:[{faceit_player_id:'player-id',nickname:'Example',kills:21,deaths:18}]});
 const html=renderProfile(template,metadata);
 assert.match(html,/<title>UK RIPPER vs CloudPeppers 11–13/);
 assert.match(html,/Ancient: 11–13/);assert.match(html,/href="\/teams\/uk-ripper-one"/);assert.match(html,/href="\/players\/Example"/);
 assert.match(html,new RegExp(`rel="canonical" href="https://eseatracker.ru/match/${match.id}"`));
 assert.equal((html.match(/<h1/g)||[]).length,1);assert.match(html,/<html lang="en">/);
 assert.deepEqual(metadata.schema['@graph'].find(node=>node['@type']==='WebPage').about.map(team=>team.identifier),['one','two']);
 assert.doesNotMatch(JSON.stringify(metadata.schema), /SportsEvent|EventScheduled|EventCancelled/);
 assert.match(metadata.description,/2026-07-21/);
});
test('scheduled matches do not claim a 0–0 result or invent a date',()=>{
 const m=getMatchSeoMetadata({...match,status:'SCHEDULED',scheduled_at:null});
 assert.doesNotMatch(m.title,/11–13|0–0/);assert.match(m.title,/Schedule/);
 assert.equal(m.schema['@graph'].some(n=>n['@type']==='SportsEvent'),false);
});
test('cancelled matches are noindex and unsafe team names cannot inject HTML',()=>{
 const m=profileMetadata('match',{...match,team1_name:'</script><script>alert(1)</script>',status:'MATCH_STATUS_CANCELLED'},{teams:[],players:[]});
 const html=renderProfile(template,m);assert.match(html,/noindex,follow/);assert.doesNotMatch(html,/<script>alert/);
});
test('BO3 map results follow exact team IDs when map sides are reversed',()=>{
 const html=renderProfile(template,profileMetadata('match',{...match,best_of:3,map_scores:[{map:'Nuke',team1_id:'two',team1_score:9,team2_score:13}]},{teams:[],players:[]}));
 assert.match(html,/Nuke: 13–9/);
});
test('player HTML includes individual facts and recent match links',()=>{
 const html=renderProfile(template,profileMetadata('player',{playerId:'0e12ed48-9068-47a5-8f16-11c6694373c8',nickname:'Jeeden',rating:1.2,adr:84,kd:1.3,mapsPlayed:10},[],'',[match]));
 assert.match(html,/Jeeden CS2/);assert.match(html,/<dt>ADR<\/dt><dd>84<\/dd>/);assert.match(html,/href="\/match\/1-117a356c/);assert.match(html,/<html lang="en">/);
});
test('each public directory has a distinct canonical and unknown pages are noindex',()=>{
 for(const route of Object.keys(pageMetadata)) {const m=getSiteSeoMetadata(route);const html=renderProfile(template,m);assert.match(html,new RegExp(`rel="canonical" href="https://eseatracker.ru${route}"`));}
 assert.match(getSiteSeoMetadata('/register').robots,/noindex/);
});
test('match aliases redirect and match sitemap/profile rewrites precede SPA fallback',()=>{
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.equal(v.redirects.find(r=>r.source==='/matches/:key').destination,'/match/:key');
 assert.equal(v.redirects.find(r=>r.source==='/teams/:slug/matches/:key').destination,'/match/:key');
 assert.ok(v.rewrites.find(r=>r.source==='/match/:key'));
 assert.match(v.rewrites.find(r=>r.source.startsWith('/sitemaps/')).source,/matches/);
 assert.equal(v.rewrites.at(-1).destination,'/index.html');
});
