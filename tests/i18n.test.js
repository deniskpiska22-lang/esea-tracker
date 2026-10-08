import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import catalog from '../src/i18n/catalog.json' with {type:'json'};
import { LANGUAGES, localizedPath, stripLanguage, languageFromPath } from '../src/i18n/languages.js';
import { translateText } from '../src/i18n/translate.js';
import { localizeSeo } from '../src/i18n/seo.js';
import { getSiteSeoMetadata } from '../src/utils/siteSeo.js';
import { profileMetadata, renderProfile, sitemapXml } from '../server/profileSeo.js';
const template='<html><head><title>Default</title></head><body><div id="root"></div></body></html>';
test('all authored catalog entries have translations for every requested language',()=>{
  assert.ok(Object.keys(catalog).length>600);
  for(const [key, row] of Object.entries(catalog)) for(const {code} of LANGUAGES) {
    if(code==='en') continue;
    assert.equal(typeof row[code],'string',`${key}: ${code}`);
    assert.ok(row[code].trim(),`${key}: ${code}`);
    assert.deepEqual([...row[code].matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...key.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort());
  }
});
test('language prefixes preserve stable entity IDs, filters and hashes',()=>{
  for(const {code} of LANGUAGES) {
    const original='/de/teams/one%20two/stats?map=Nuke#history';
    const result=localizedPath(original,code);
    assert.equal(stripLanguage(result),'/teams/one%20two/stats?map=Nuke#history');
    assert.equal(languageFromPath(result),code);
    assert.equal(localizedPath(result,code),result);
  }
});
test('all directory locales render translated crawlable HTML, reciprocal hreflang and self canonicals',()=>{
  for(const {code,og} of LANGUAGES) {
    const metadata=localizeSeo({...getSiteSeoMetadata('/rankings'),body:'<h2>Explore ESEA CS2 teams</h2>'},code);
    const html=renderProfile(template,metadata);
    assert.match(html,new RegExp(`<html lang="${code}">`));
    assert.ok(html.includes(translateText('Explore ESEA CS2 teams',code)));
    assert.ok(html.includes(`content="${og}"`));
    assert.ok(html.includes(`rel="canonical" href="https://eseatracker.ru${localizedPath('/rankings',code)}"`));
    assert.equal((html.match(/hreflang=/g)||[]).length,8);
    assert.ok(html.includes('hreflang="x-default" href="https://eseatracker.ru/en/rankings"'));
  }
});
test('team localization preserves entity identity, links and escaping in all locales',()=>{
  const entity={slug:'test-team-id',name:'<bad> & Team',faceitTeamId:'stable-team-id',division:'Main',region:'Europe'};
  for(const {code} of LANGUAGES) {
    const metadata=localizeSeo(profileMetadata('team',entity,[{nickname:'ExactName',faceit_id:'stable-player-id'}]),code,{kind:'team',entity});
    const html=renderProfile(template,metadata);
    assert.doesNotMatch(html,/<bad>/);
    assert.ok(html.includes(`href="${localizedPath('/players/stable-player-id',code)}"`));
    assert.ok(html.includes('ExactName'));
    assert.ok(JSON.stringify(metadata.schema).includes('stable-team-id'));
    assert.ok(JSON.stringify(metadata.schema).includes(`"inLanguage":"${code}"`));
  }
});
test('sitemap expansion remains under URL limit and translated rewrites reach the real profile handler',()=>{
  const config=JSON.parse(readFileSync('vercel.json'));
  for(const rule of config.rewrites.filter(rule=>rule.source.includes(':lang'))) assert.ok(rule.destination.includes('&lang=:lang'));
  const xml=sitemapXml(LANGUAGES.map(({code})=>({url:'https://eseatracker.ru'+localizedPath('/teams/stable',code)})));
  assert.equal((xml.match(/<url>/g)||[]).length,7);
  assert.ok(1000*4*LANGUAGES.length<50000);
  const privatePage=localizeSeo(getSiteSeoMetadata('/login'),'de');
  assert.equal(privatePage.alternates.length,0);
});
