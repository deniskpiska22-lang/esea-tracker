import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createEloRefresher, createPlayerEloHandler, playerEloIds } from '../server/playerElo.js';
import { loadMissingPlayerElo } from '../src/utils/playerElo.js';
import { playerEloCandidates } from '../scripts/lib/playerEloQueue.js';

const one = '11111111-1111-4111-8111-111111111111';
const two = '22222222-2222-4222-8222-222222222222';
const now = Date.parse('2026-10-28T05:00:00Z');
const player = { faceit_id: one, faceit_elo: null, faceit_profile_synced_at: null };
const profile = { player_id: one, games: { cs2: { faceit_elo: 2847, skill_level: 10 } } };
function database() {
  const writes = [];
  return { writes, db: { from(table) { assert.equal(table, 'players'); return {
    update(patch) { writes.push(patch); return this; },
    eq(column, id) { assert.equal(column, 'faceit_id'); assert.equal(id, one); return this; },
    or(filter) { assert.equal(filter, 'faceit_elo.is.null,faceit_elo.lte.0'); return this; },
    select() { return this; },
    async maybeSingle() { return { data: { ...player, ...writes.at(-1) } }; },
  }; } } };
}
function res() { return { code: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; },
  status(code) { this.code=code; return this; }, json(body) { this.body=body; return this; } }; }

test('ELO lookup accepts bounded immutable IDs, not nicknames or filters', () => {
  assert.deepEqual(playerEloIds(`${one},${one}`), [one]);
  for (const value of ['', 'nickname', `${one},bad`, `${one}),id.neq.anything`, Array(11).fill(0).map((_,i) => `${String(i).padStart(8,'0')}-1111-4111-8111-111111111111`).join(',')])
    assert.equal(playerEloIds(value), null);
});
test('missing ELO is fetched once per immutable ID and persisted without touching identity', async () => {
  const { db, writes } = database();
  let calls = 0;
  const refresh = createEloRefresher({ db, apiKey: 'test', now: () => now,
    fetchImpl: async () => { calls++; return new Response(JSON.stringify(profile)); } });
  const [a,b] = await Promise.all([refresh(player),refresh(player)]);
  assert.equal(calls,1); assert.equal(writes.length,1); assert.equal(a,b);
  assert.deepEqual(writes[0], { faceit_profile_synced_at: new Date(now).toISOString(), faceit_elo: 2847, faceit_level: 10 });
});
test('known ELO and recently checked missing CS2 profiles are not re-downloaded', async () => {
  const { db, writes } = database();
  const refresh = createEloRefresher({ db, apiKey: 'test', now: () => now,
    fetchImpl: () => { throw new Error('Must not fetch'); } });
  assert.equal(await refresh({ ...player, faceit_elo: 2500 }), null);
  assert.equal(await refresh({ ...player, faceit_profile_synced_at: new Date(now-1000).toISOString() }), null);
  assert.equal(writes.length,0);
});
test('provider outages and mismatched identities preserve data; rate limits stop further calls', async () => {
  for (const status of [401,403,429]) {
    const { db, writes } = database(); let calls=0;
    const refresh=createEloRefresher({ db,apiKey:'test',now:()=>now,
      fetchImpl:async()=>{ calls++; return new Response('',{status}); } });
    assert.equal(await refresh(player),null); assert.equal(await refresh({...player,faceit_id:two}),null);
    assert.equal(calls,1); assert.equal(writes.length,0);
  }
  for (const fetchImpl of [async()=>{throw new Error('timeout');},async()=>new Response('',{status:500}),
    async()=>new Response(JSON.stringify({...profile,player_id:two}))]) {
    const {db,writes}=database();
    assert.equal(await createEloRefresher({db,apiKey:'test',fetchImpl,now:()=>now})(player),null);
    assert.equal(writes.length,0);
  }
});
test('no CS2 and deleted profiles are checkpointed without invented zero or CSGO ELO', async () => {
  for (const response of [new Response('',{status:404}),new Response(JSON.stringify({player_id:one,games:{csgo:{faceit_elo:4000}}}))]) {
    const {db,writes}=database();
    await createEloRefresher({db,apiKey:'test',now:()=>now,fetchImpl:async()=>response})(player);
    assert.deepEqual(writes,[{faceit_profile_synced_at:new Date(now).toISOString()}]);
  }
});
test('only existing players can trigger refresh and response contains only ELO fields', async () => {
  let refreshed=0;
  const handler=createPlayerEloHandler({load:async ids=>{assert.deepEqual(ids,[one,two]);return [player];},
    refresh:async()=>{refreshed++;return {...player,faceit_elo:2847,faceit_level:10,private:'hidden'};}});
  const response=res(); await handler({method:'GET',query:{ids:`${one},${two}`}},response);
  assert.equal(refreshed,1);assert.equal(response.code,200);
  assert.deepEqual(response.body,{ok:true,players:[{faceit_id:one,faceit_elo:2847,faceit_level:10}]});
  for(const request of [{method:'POST',query:{ids:one}},{method:'GET',query:{ids:'bad'}}]) {
    const rejected=res();await handler(request,rejected);assert.ok(rejected.code>=400);
  }
});
test('background selection includes former players, prioritizes missing values and retains routine refresh', async () => {
  const urls=[];
  const db=createClient('https://example.supabase.co','test',{global:{fetch:async url=>{
    urls.push(new URL(url));return new Response(JSON.stringify(urls.length===1?[{faceit_id:two}]:[{faceit_id:one},{faceit_id:two}]));
  }}});
  assert.deepEqual(await playerEloCandidates(db,{now}),[{faceit_id:two},{faceit_id:one}]);
  assert.equal(urls.length,2);
  assert.ok(urls[0].searchParams.get('or').includes('faceit_elo.is.null'));
  assert.ok(urls[0].searchParams.get('or').includes('faceit_profile_synced_at.lt.'));
  assert.equal(urls[0].searchParams.get('limit'),'180');
  for(const url of urls) assert.equal(url.searchParams.get('select'),'faceit_id');
});
test('client refreshes missing ratings only and discards unrelated or invalid values', async () => {
  let calls=0;
  const fetchImpl=async()=>{calls++;return new Response(JSON.stringify({ok:true,players:[
    {faceit_id:one,faceit_elo:2847,faceit_level:10,nickname:'wrong'},
    {faceit_id:two,faceit_elo:9999,faceit_level:10},
  ]}));};
  const input=[player,{faceit_id:two,faceit_elo:2000}];
  const [a,b]=await Promise.all([loadMissingPlayerElo(input,fetchImpl),loadMissingPlayerElo(input,fetchImpl)]);
  assert.equal(calls,1);assert.deepEqual([...a],[[one,{faceit_elo:2847,faceit_level:10}]]);assert.deepEqual(a,b);
  assert.deepEqual([...await loadMissingPlayerElo([{faceit_id:two,faceit_elo:2000}],fetchImpl)],[]);
});
