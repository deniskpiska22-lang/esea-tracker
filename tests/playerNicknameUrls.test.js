import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlayerSeoMetadata } from '../src/utils/playerSeo.js';
import { localizeSeo } from '../src/i18n/seo.js';
const playerId='6faa2cdd-89f2-48af-ad5c-6008c5888784';
test('nickname canonical keeps FACEIT identity out of the public URL across languages',()=>{
 for(const language of ['ru','en','de','pt','es','fr','it']) {
  const metadata=localizeSeo(getPlayerSeoMetadata({playerId,nickname:'Gashhhhi4'}),language);
  assert.equal(metadata.canonicalPath,`${language==='ru'?'':'/'+language}/players/Gashhhhi4`);
  assert.ok(!metadata.canonicalUrl.includes(playerId));
 }
});
test('nicknames are encoded safely and profiles without a known nickname retain their ID',()=>{
 assert.equal(getPlayerSeoMetadata({playerId,nickname:'a/b ?#'}).canonicalPath,'/players/a%2Fb%20%3F%23');
 assert.equal(getPlayerSeoMetadata({playerId}).canonicalPath,`/players/${playerId}`);
});
