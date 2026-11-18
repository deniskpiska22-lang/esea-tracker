import test from 'node:test';
import assert from 'node:assert/strict';
import {coachPath,coachLookupKey} from '../src/utils/coachPath.js';
import {getCoachSeo} from '../src/utils/coachSeo.js';
test('coach-only profiles use nicknames and retain the selected tab',()=>{
 assert.equal(coachPath({id:'id',nickname:'WESTAR'}),'/coach/WESTAR');
 assert.equal(coachPath({id:'id',nickname:'heidi_'},'teams'),'/coach/heidi_?tab=teams');
 assert.equal(getCoachSeo('id',{nickname:'WESTAR'},'en').canonicalPath,'/en/coach/WESTAR');
});
test('linked player/coach identities retain their shared nickname profile',()=>{
 assert.equal(coachPath({id:'id',nickname:'old-name',playerNickname:'LisssTzz'},'teams'),'/players/LisssTzz?role=coach&tab=teams');
});
test('legacy UUID links still resolve by immutable ID while readable routes resolve by nickname',()=>{
 assert.equal(coachLookupKey('e0581ab1-34f6-4d6c-922d-ad5bdc02c893'),'id');
 assert.equal(coachLookupKey('WESTAR'),'player');
 assert.equal(coachPath({nickname:'name with space'}),'/coach/name%20with%20space');
});
