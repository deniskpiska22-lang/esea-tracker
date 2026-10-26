import test from 'node:test';
import assert from 'node:assert/strict';
import {isMatchPath,matchLinkState,matchBackLink} from '../src/utils/matchNavigation.js';
test('home-origin match links override team fallback and retain translated home label',()=>{
 const state=matchLinkState('/match/1-id',{pathname:'/',search:'?division=main',hash:''});
 assert.deepEqual(matchBackLink(state,'team-a'),{to:'/?division=main',label:'← Back to Home'});
 assert.deepEqual(matchBackLink({from:'/',label:'← Back to Home'},'team-a'),{to:'/',label:'← Back to Home'});
});
test('team match lists, profiles, calendars and another match retain their source and filters',()=>{
 for(const [path,label] of [['/teams/a/matches?period=90d','← Back to Matches'],['/teams/a','← Back to Team'],['/calendar?division=main','← Back to Calendar'],['/match/previous','← Back to Match']]){
  const state=matchLinkState('/teams/a/matches/next',{pathname:path});
  assert.deepEqual(matchBackLink(state,'wrong-team'),{to:path,label});
 }
 assert.deepEqual(matchLinkState('/teams/a',{pathname:'/'},{from:'/matches'}),{from:'/matches'});
});
test('locale basename is not duplicated and explicit location objects are accepted',()=>{
 assert.deepEqual(matchBackLink({from:'/en/?division=main'},'a'),{to:'/?division=main',label:'← Back to Home'});
 assert.deepEqual(matchBackLink({from:{pathname:'/en/teams/a/matches',search:'?period=3m'}},'b'),{to:'/teams/a/matches?period=3m',label:'← Back to Matches'});
 assert.ok(isMatchPath({pathname:'/en/match/id'}));
});
test('direct entries use a safe fallback; external and malformed state cannot redirect away',()=>{
 assert.deepEqual(matchBackLink(null,null),{to:'/',label:'← Back to Home'});
 for(const from of ['//evil.example','https://evil.example','javascript:alert(1)','/\\evil','/en//evil',{},42])assert.deepEqual(matchBackLink({from},'a'),{to:'/teams/a/matches',label:'← Back to Matches'});
 assert.equal(isMatchPath(null),false);
 assert.equal(isMatchPath('/teams/a/matches'),false);
 assert.equal(isMatchPath('https://evil.example/match/id'),false);
});
