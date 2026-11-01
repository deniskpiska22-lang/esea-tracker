import test from 'node:test';
import assert from 'node:assert/strict';
import {shareSnapshot,shareResults,shareTeamUrl} from '../src/utils/teamShare.js';
import {teamShareLabels} from '../src/components/teamShareLabels.js';
import {createTeamShareHandler} from '../api/team-share.js';
const id='273e5af7-767e-42da-9b1b-cc501b780bd0';
test('weekly comparisons require exactly the previous week; historical world rank is kept',()=>{
 const rows=[{week_start:'2026-10-19',points:602,world_rank:24},{week_start:'2026-10-26',points:602,world_rank:23}];
 assert.deepEqual(shareSnapshot(rows),{date:'2026-10-26',start:'2026-10-19',end:'2026-10-26',rank:23,points:602,previousRank:24,change:1});
 assert.equal(shareSnapshot([rows[1],{...rows[0],week_start:'2026-10-12'}]).change,null);
 assert.equal(shareSnapshot([{...rows[1],world_rank:null}]).rank,null);
 assert.equal(shareSnapshot([]),null);
});
test('weekly played results are ID-bound, deduplicated and use a half-open UTC period',()=>{
 const base={id:'one',team1_id:id,team2_id:'opponent',status:'FINISHED',finished_at:'2026-10-19T00:00:00Z',team1_score:13,team2_score:7};
 const rows=[base,base,{...base,id:'loss',team1_score:7,team2_score:13},{...base,id:'technical',team1_score:1,team2_score:0},
 {...base,id:'end',finished_at:'2026-10-26T00:00:00Z'}, {...base,id:'before',finished_at:'2026-10-18T23:59:59Z'},
 {...base,id:'other',team1_id:'unrelated'}, {...base,id:'unfinished',status:'SCHEDULED'},
 {...base,id:'series',team1_score:2,team2_score:0,map_scores:[{team1_score:13,team2_score:2}]}];
 assert.deepEqual(shareResults(rows,id,'2026-10-19','2026-10-26'),{wins:2,losses:1,form:['W','L','W']});
 assert.equal(shareResults(null,id,'2026-10-19','2026-10-26'),null);
});
test('canonical team URLs and captions have complete labels in all site languages',()=>{
 for(const lang of ['ru','en','de','pt','es','fr','it']){
  const labels=teamShareLabels(lang);for(const value of Object.values(labels))assert.ok(typeof value==='string'&&value.length);
  assert.equal(new URL(shareTeamUrl({profileSlug:'eternal-premium',faceitTeamId:id},lang)).pathname,`${lang==='ru'?'':`/${lang}`}/teams/eternal-premium`);
 }
 assert.ok(shareTeamUrl({faceitTeamId:id},'en').endsWith(id));
});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){return this;}});
test('public handler rejects invalid input before DB lookup and fails without fictional results',async()=>{
 let calls=0;const handler=createTeamShareHandler(async()=>{calls++;return null;});
 const bad=response();await handler({method:'GET',query:{teamId:'bad,filter'}},bad);assert.equal(bad.code,400);assert.equal(calls,0);
 const method=response();await handler({method:'POST',query:{teamId:id}},method);assert.equal(method.code,405);assert.equal(calls,0);
 const ok=response();await handler({method:'GET',query:{teamId:id}},ok);assert.equal(ok.code,200);assert.deepEqual(ok.body,{snapshot:null});
 const failed=response();await createTeamShareHandler(async()=>{throw new Error('private detail');})({method:'GET',query:{teamId:id}},failed);assert.equal(failed.code,503);assert.equal(failed.headers['Cache-Control'],'no-store');assert.ok(!JSON.stringify(failed.body).includes('private detail'));
});
test('logo action is bound to the validated team ID and returns binary image data only',async()=>{
 const idValue=id;let actual;
 const handler=createTeamShareHandler(async()=>{throw new Error('not used');},{loadLogo:async value=>{actual=value;return {type:'image/png',data:new Uint8Array([137,80])};}});
 const res=response();res.send=function(data){this.binary=data;return this;};
 await handler({method:'GET',query:{teamId:idValue,action:'logo'}},res);
 assert.equal(actual,idValue);assert.equal(res.code,200);assert.equal(res.headers['Content-Type'],'image/png');assert.equal(res.binary.length,2);
 const invalid=response();await handler({method:'GET',query:{teamId:idValue,action:'http://internal'}},invalid);assert.equal(invalid.code,400);
});
