import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/pari.js';
import { createWebServer } from '../server/web.js';
const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(c){this.code=c;return this;},end(){return this;},redirect(c,url){this.code=c;this.location=url;return this;}});
test('Russian placement redirects to the unchanged PARI partner without allowing overrides',()=>{
 for (const placement of ['team_profile_native','match_room_native']) {
  const res=handler({method:'GET',headers:{'x-vercel-ip-country':'RU'},query:{placement,partner_id:'evil',url:'https://evil.example'}},response());
  assert.equal(res.code,302);
  const url=new URL(res.location);
  assert.equal(url.origin,'https://clicks.af-pb06e2.com');
  assert.equal(url.searchParams.get('partner_id'),'34440');
  assert.equal(url.searchParams.get('offer_id'),'812');
  assert.equal(url.searchParams.get('landing_id'),'88');
  assert.equal(url.searchParams.get('utm_content'),placement);
  assert.match(res.headers['Cache-Control'],/no-store/);
 }
});
test('non-Russian and unknown GEO cannot use PARI redirect',()=>{
 for(const country of ['US','DE','',undefined])assert.equal(handler({method:'GET',headers:{'x-vercel-ip-country':country},query:{}},response()).code,403);
 assert.equal(handler({method:'POST',headers:{'x-vercel-ip-country':'RU'},query:{}},response()).code,405);
});
test('Railway exposes the redirect and derives RU from the trusted IP lookup',async t=>{
 const server=createWebServer({geoOptions:{trustRailway:false,lookup:()=>({country:'RU'})}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const res=await fetch(`http://127.0.0.1:${server.address().port}/api/pari?placement=match_room_native`,{redirect:'manual'});
 assert.equal(res.status,302);assert.equal(new URL(res.headers.get('location')).searchParams.get('partner_id'),'34440');
});
