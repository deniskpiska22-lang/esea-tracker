import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdPolicyLoader } from '../src/lib/adPolicy.js';
test('GEO changes after cache expiry or a forced connection check, with shared concurrent requests', async () => {
 let time=0,calls=0,country='RU';
 const load=createAdPolicyLoader({now:()=>time,fetchImpl:async()=>{calls++;return new Response(JSON.stringify({country}));}});
 assert.deepEqual(await Promise.all([load(),load()]),[{country:'RU'},{country:'RU'}]);assert.equal(calls,1);
 country='DE';time=1000;assert.equal((await load()).country,'RU');
 assert.equal((await load({force:true})).country,'DE');assert.equal(calls,2);
 country='NL';time=32000;assert.equal((await load()).country,'NL');assert.equal(calls,3);
});
test('failed GEO check clears the previous country rather than keeping the wrong provider',async()=>{
 let fail=false;
 const load=createAdPolicyLoader({fetchImpl:async()=>{if(fail)throw Error('offline');return new Response('{"country":"RU"}');}});
 assert.equal((await load()).country,'RU');fail=true;assert.equal(await load({force:true}),null);
});
