import test from 'node:test';
import assert from 'node:assert/strict';
import { findTeamByRoute, teamPublicPath } from '../src/utils/teamProfileUrls.js';
import { getTeamSeoMetadata } from '../src/utils/teamSeo.js';
const teams=[
 {faceitTeamId:'identity-a',name:'NAVI Junior',slug:'navi-junior-05eaa5ef',profileSlug:'navi-junior',urlAliases:['navi-junior-05eaa5ef','old-name']},
 {faceitTeamId:'identity-b',name:'NAVI Junior',slug:'navi-junior-abcdefab',profileSlug:'navi-junior-2',urlAliases:['navi-junior-abcdefab']},
];
test('public names, full IDs and retained aliases resolve one exact FACEIT team',()=>{
 for(const key of ['navi-junior','navi-junior-05eaa5ef','old-name','identity-a'])assert.equal(findTeamByRoute(teams,key).faceitTeamId,'identity-a');
 assert.equal(findTeamByRoute(teams,'navi-junior-2').faceitTeamId,'identity-b');
 assert.equal(findTeamByRoute(teams,'unknown'),null);
});
test('all locale and section links retain filters and fragments when the ID suffix disappears',()=>{
 for(const prefix of ['', '/en','/de','/pt','/es','/fr','/it'])for(const section of ['', '/matches','/stats','/veto']) {
  assert.equal(teamPublicPath(`${prefix}/team/navi-junior-05eaa5ef${section}?map=Nuke#history`,teams),`${prefix}/teams/navi-junior${section}?map=Nuke#history`);
 }
 assert.deepEqual(teamPublicPath({pathname:'/teams/identity-a/veto',search:'?x=1'},teams),{pathname:'/teams/navi-junior/veto',search:'?x=1'});
 assert.equal(teamPublicPath('https://faceit.com/teams/identity-a',teams),'https://faceit.com/teams/identity-a');
 assert.equal(teamPublicPath('/players/someone',teams),'/players/someone');
});
test('SEO uses readable canonical while structured identity remains FACEIT ID',()=>{
 const seo=getTeamSeoMetadata(teams[0],'veto');
 assert.equal(seo.canonicalPath,'/teams/navi-junior/veto');
 assert.equal(seo.schema['@graph'][0].identifier,'identity-a');
});
