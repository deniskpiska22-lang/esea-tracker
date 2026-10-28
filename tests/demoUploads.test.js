import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { demoUploadMatchId, validDemoUpload, DEMO_UPLOAD_LIMIT } from '../src/utils/demoUpload.js';
import { createAdminApi } from '../src/components/admin/adminApi.js';
import { roundSnapshot, reconstructRounds } from '../workers/demo-stats/rounds.js';
import { verifiedTeamRounds } from '../src/utils/demoRoundStats.js';

const id = '1-2c5bdd12-6a65-4823-b774-fcf0e257a059';
test('upload input binds trusted site/FACEIT links to one immutable room and bounds files', () => {
  for (const input of [id, `https://eseatracker.ru/en/match/${id}/one-vs-two?x=1`, `https://www.faceit.com/en/cs2/room/${id}`]) assert.equal(demoUploadMatchId(input), id);
  for (const input of ['', '../test', id+'/other', `https://evil.example/match/${id}`, `https://eseatracker.ru.evil.example/match/${id}`]) assert.equal(demoUploadMatchId(input), null);
  for (const name of ['match.dem','match.dem.gz','match.DEM.ZST']) assert.equal(validDemoUpload({name,size:DEMO_UPLOAD_LIMIT}), true);
  for (const file of [null, {name:'x.zip',size:100}, {name:'x.dem',size:7}, {name:'x.dem',size:DEMO_UPLOAD_LIMIT+1}]) assert.equal(validDemoUpload(file), false);
});

test('the real ESEA Dust2 fixture agrees with FACEIT 6:13, halves, sides and two pistols', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/esea-dust2-rounds.json',import.meta.url),'utf8'));
  const {context} = fixture;
  const snapshots = fixture.rounds.map(r=>roundSnapshot(r.event,r.players,context,r.epoch));
  const result = reconstructRounds(snapshots,{team1:{id:context.team1.id,score:6},team2:{id:context.team2.id,score:13}});
  assert.equal(result.halfLength,12);
  assert.deepEqual(result.teams.map(t=>t.score),[6,13]);
  assert.deepEqual([result.teams[0].ct.won,result.teams[1].t.won],fixture.officialHalves[0]);
  assert.deepEqual([result.teams[0].t.won,result.teams[1].ct.won],fixture.officialHalves[1]);
  assert.deepEqual(result.teams.map(t=>t.pistol.won),[2,0]);
  assert.equal(result.teams[0].ct.total+result.teams[0].t.total,19);
  assert.ok(verifiedTeamRounds(result,context.team1.id,6,13));
  // A missing first live round must not be replaced with the earlier knife win.
  assert.throws(()=>reconstructRounds(snapshots.filter(r=>r.tick!==19233),{team1:{id:context.team1.id,score:6},team2:{id:context.team2.id,score:13}}),/restart/);
});

test('an upload is committed only after a successful private storage upload', async () => {
  const calls=[];
  const db={rpc:async(name)=>{calls.push(name);return {data:name==='admin_prepare_demo_upload'?{id:'upload',path:`${id}/upload.dem`,bucket:'match-demo-inbox'}:true};},storage:{from:bucket=>({upload:async(path)=>{calls.push([bucket,path]);return {data:{path}};}})}};
  const api=createAdminApi(db);
  await api.uploadDemo({matchId:id,file:{name:'x.dem',size:100}});
  assert.deepEqual(calls,['admin_prepare_demo_upload',['match-demo-inbox',`${id}/upload.dem`],'admin_commit_demo_upload']);
  calls.length=0;
  db.storage.from=()=>({upload:async()=>({error:new Error('network failed')})});
  await assert.rejects(api.uploadDemo({matchId:id,file:{name:'x.dem',size:100}}),/network failed/);
  assert.deepEqual(calls,['admin_prepare_demo_upload','admin_abort_demo_upload']);
});
