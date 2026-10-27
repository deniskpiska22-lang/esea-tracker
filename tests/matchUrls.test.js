import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPublicPath } from '../src/utils/matchUrls.js';
import { getMatchSeoMetadata } from '../src/utils/matchSeo.js';
import { resolveRewrite } from '../server/webRouting.js';
import { isMatchPath, matchLinkState, matchBackLink } from '../src/utils/matchNavigation.js';
const record={id:'1-029d9df5-94fe-402b-bf0b-399bd693c1fd',team1_name:'Phantom Esports Academy',team2_name:'Growth Lab Esport'};
test('names decorate an immutable ID rather than replacing match identity',()=>{
 const path=matchPublicPath(record);
 assert.equal(path,`/match/${record.id}/phantom-esports-academy-vs-growth-lab-esport`);
 assert.equal(getMatchSeoMetadata(record).canonicalPath,path);
 assert.equal(matchPublicPath({...record,team2_name:'Renamed Team'}),`/match/${record.id}/phantom-esports-academy-vs-renamed-team`);
});
test('names stay readable and unsafe punctuation cannot become URL structure',()=>{
 const path=matchPublicPath({...record,team1_name:'TÉAM / A? # <script>',team2_name:'Банда 5'});
 assert.equal(path,`/match/${record.id}/team-a-script-vs-${encodeURIComponent('банда-5')}`);
 const meta=getMatchSeoMetadata({...record,team1_name:record.id});
 assert.ok(!meta.title.includes(record.id));
 assert.ok(!meta.description.includes(record.id));
 assert.equal(meta.canonicalPath,matchPublicPath({...record,team1_name:record.id}));
});
test('all localized named routes resolve to the same match SEO API, including old ID routes',()=>{
 for(const lang of ['', '/en','/de','/pt','/es','/fr','/it']) {
  const route=resolveRewrite(lang+matchPublicPath(record),'');
  assert.equal(route.pathname,'/api/seo-profile');
  assert.equal(route.query.kind,'match');
  assert.equal(route.query.key,record.id);
  assert.equal(route.query.slug,'phantom-esports-academy-vs-growth-lab-esport');
  assert.equal(resolveRewrite(`${lang}/match/${record.id}`,'').query.key,record.id);
 }
});
test('named match navigation retains back origin, query and hash',()=>{
 const path=matchPublicPath(record);
 assert.equal(isMatchPath(path),true);
 assert.deepEqual(matchLinkState(path,{pathname:'/',search:'?division=advanced',hash:'#matches'}),{from:'/?division=advanced#matches'});
 assert.deepEqual(matchBackLink({from:path},'unrelated'),{to:path,label:'← Back to Match'});
});
