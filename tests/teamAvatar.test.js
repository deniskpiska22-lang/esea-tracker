import test from 'node:test';
import assert from 'node:assert/strict';
import { validFaceitAvatar, withCurrentTeamAvatar } from '../src/utils/teamAvatar.js';
import { resolveMatchTeam } from '../src/utils/matchTeamIdentity.js';
const fresh='https://distribution.faceit-cdn.net/images/new.jpg';
test('only a valid HTTPS FACEIT avatar replaces a saved logo',()=>{
 const team={faceitTeamId:'one',name:'OldBoys',logo:'/saved.jpg'};
 assert.deepEqual(withCurrentTeamAvatar(team,fresh),{...team,logo:fresh,faceitAvatar:fresh});
 for(const input of [null,'','javascript:alert(1)','http://distribution.faceit-cdn.net/a','https://evil-faceit-cdn.net/a','https://u:p@distribution.faceit-cdn.net/a']) {
  assert.equal(validFaceitAvatar(input),null);assert.equal(withCurrentTeamAvatar(team,input),team);
 }
});
test('current team avatar supersedes a stale match snapshot only for the exact team ID',()=>{
 const catalog=[withCurrentTeamAvatar({faceitTeamId:'one',name:'OldBoys',slug:'oldboys',logo:'/old.jpg'},fresh)];
 const raw={teams:{faction1:{faction_id:'one',name:'OldBoys',avatar:'/stale.jpg'}}};
 assert.equal(resolveMatchTeam(catalog,{id:'one',name:'OldBoys'},raw).logo,fresh);
 assert.notEqual(resolveMatchTeam(catalog,{id:'other',name:'OldBoys',logo:'/other.jpg'},raw).logo,fresh);
});
