import test from 'node:test';
import assert from 'node:assert/strict';
import { requestCoachData } from '../src/lib/coachRequest.js';
const response=(status,data)=>({status,ok:status===200,json:async()=>data});
test('temporary coach failures retry once and retain the response contract',async()=>{
  let calls=0;
  const result=await requestCoachData('/api/coach',{wait:async()=>{},fetchImpl:async()=>++calls===1 ? response(503) : response(200,{nickname:'Coach'})});
  assert.equal(calls,2);assert.deepEqual(result,{status:200,data:{nickname:'Coach'}});
});
test('missing coaches are not retried or replaced with an empty success',async()=>{
  let calls=0;
  const result=await requestCoachData('/api/coach',{fetchImpl:async()=>{calls++;return response(404);}});
  assert.equal(calls,1);assert.deepEqual(result,{status:404,data:null});
});
test('coach network retries are bounded and aborted navigation never retries',async()=>{
  let calls=0;
  await assert.rejects(requestCoachData('/api/coach',{wait:async()=>{},fetchImpl:async()=>{calls++;throw new Error('offline');}}),/offline/);
  assert.equal(calls,2);
  const controller=new AbortController();controller.abort();
  await assert.rejects(requestCoachData('/api/coach',{signal:controller.signal,fetchImpl:async()=>{throw new Error('must not run');}}),/aborted/);
});
