import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
process.env.FACEIT_API_KEY='fixture-key';
delete process.env.SUPABASE_URL;
const {importTournament}=await import('../scripts/importTournament.js');
const id='3772a957-ef30-490f-9546-4ac53ec5bcb5';
const oldFetch=globalThis.fetch;
const meta={name:'Fixture qualifier',game_id:'cs2',status:'ONGOING',type:'swiss',championship_start:1795000000};
const match={match_id:'fixture-game',competition_id:id,status:'FINISHED',round:1,finished_at:1795003600,
  teams:{faction1:{faction_id:'one',name:'One'},faction2:{faction_id:'two',name:'Two'}},results:{winner:'faction1',score:{faction1:13,faction2:8}}};
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
test('official subscription pages use the documented limit and team_id identity',async()=>{
 const calls=[];globalThis.fetch=async input=>{
  const url=new URL(input);calls.push(url);
  if(url.pathname.endsWith('/subscriptions')){
   assert.equal(url.searchParams.get('limit'),'10');return response({items:[{status:'ACCEPTED',team:{team_id:'one',name:'One',avatar:'https://example.com/logo.png'}}]});
  }
  if(url.pathname.endsWith('/matches'))return response({items:[match]});
  return response(meta);
 };
 try {
  const {entry}=await importTournament(id,{jsonList:[],tier:'C',prizePool:'175,000 RUB'});
  assert.equal(entry.teams.length,1);assert.equal(entry.teams[0].name,'One');assert.equal(entry.prizePool,'175,000 RUB');
  assert.ok(calls.every(url=>url.host==='open.faceit.com'));assert.ok(entry.lifecycle.checkedAt);
 }finally{globalThis.fetch=oldFetch;}
});
test('a blocked optional web roster cannot prevent match and tournament import',async()=>{
 globalThis.fetch=async input=>{
  const url=new URL(input);
  if(url.pathname.endsWith('/subscriptions'))return response({},403);
  if(url.host==='www.faceit.com')return response({},403);
  if(url.pathname.endsWith('/matches'))return response({items:[match]});
  return response(meta);
 };
 try{
  const {entry,rawMatches}=await importTournament(id,{jsonList:[],tier:'C'});
  assert.equal(rawMatches.length,1);assert.equal(entry.teams.length,2);
  assert.deepEqual(entry.teams.map(team=>team.name),['One','Two']);
 }finally{globalThis.fetch=oldFetch;}
});
test('a malformed match page is rejected rather than imported as a completed empty tournament',async()=>{
 globalThis.fetch=async input=>new URL(input).pathname.endsWith('/matches')?response({unexpected:[]}):response({...meta,status:'FINISHED'});
 try{await assert.rejects(importTournament(id,{jsonList:[],tier:'C'}),/Malformed championship page/);}
 finally{globalThis.fetch=oldFetch;}
});
