import test from 'node:test';
import assert from 'node:assert/strict';
import { createOneWinAdHandler } from '../api/onewin.js';
const response = () => ({ code:200,headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},end(){return this;},redirect(code,url){this.code=code;this.location=url;return this;} });
const request = (query={},country='US') => ({method:'GET',headers:{'x-vercel-ip-country':country},query:{kind:'click',...query}});
test('CS2 fallback goes to sportsbook on configured mirror with fixed referral', async()=>{
 const handle=createOneWinAdHandler({loadConfig:async()=>({sourceOrigin:'https://one-vv8346.com'})});
 const res=await handle(request({destination:'cs2',p:'other',url:'https://evil.example',placement:'match_room_native'}),response());
 assert.equal(res.code,302);
 assert.equal(res.location,'https://one-vv8346.com/betting/esport/cs2-142?p=g39d');
 assert.match(res.headers['Cache-Control'],/no-store/);
});
test('other placements keep original link; unknown targets and invalid mirrors do not redirect',async()=>{
 const handle=createOneWinAdHandler({loadConfig:async()=>({sourceOrigin:'https://evil.example'})});
 assert.equal((await handle(request(),response())).location,'https://1win.com/?open=register&p=g39d');
 assert.equal((await handle(request({destination:'markets'}),response())).code,400);
 assert.equal((await handle(request({destination:'cs2'}),response())).code,503);
});
test('GEO and method checks run before source lookup',async()=>{
 let calls=0;const handle=createOneWinAdHandler({loadConfig:async()=>{calls++;throw Error();}});
 for(const country of ['RU',''])assert.equal((await handle(request({destination:'cs2'},country),response())).code,403);
 const req=request({destination:'cs2'});req.method='POST';assert.equal((await handle(req,response())).code,405);assert.equal(calls,0);
});
