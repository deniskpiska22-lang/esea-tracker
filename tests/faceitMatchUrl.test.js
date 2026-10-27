import test from 'node:test';
import assert from 'node:assert/strict';
import { faceitMatchRoomUrl } from '../src/utils/faceitMatchUrl.js';
const id='1-029d9df5-94fe-402b-bf0b-399bd693c1fd';
test('room URLs use the exact match ID and a concrete language instead of the API placeholder',()=>{
  assert.equal(faceitMatchRoomUrl(id),`https://www.faceit.com/en/cs2/room/${id}`);
  assert.doesNotMatch(faceitMatchRoomUrl(id),/\{|%7B|undefined/);
  assert.equal(new URL(faceitMatchRoomUrl(id)).hostname,'www.faceit.com');
});
test('unsafe or missing room IDs cannot become external destinations',()=>{
  for(const value of [null,undefined,'','../room','https://evil.test',id+'?redirect=evil',id+'/other',{},[id]]) assert.equal(faceitMatchRoomUrl(value),null);
});
