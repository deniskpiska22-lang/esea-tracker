import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { initialLanguageRedirect, preferredBrowserLanguage } from '../src/i18n/languages.js';

test('new visitors enter the English site regardless of their browser language', () => {
  assert.equal(initialLanguageRedirect({ browserLanguages: ['en-US', 'en', 'ru'] }), '/en');
  assert.equal(initialLanguageRedirect({ browserLanguages: ['en-US'] }), '/en');
  assert.equal(initialLanguageRedirect({ browserLanguages: ['ru-RU'] }), '/en');
  assert.equal(initialLanguageRedirect({ browserLanguages: ['de-DE'] }), '/en');
});
test('all seven supported languages remain available through an explicit preference', () => {
  for (const code of ['ru', 'en', 'de', 'pt', 'es', 'fr', 'it']) {
    assert.equal(preferredBrowserLanguage([`${code.toUpperCase()}-XX`, 'en']), code);
    assert.equal(initialLanguageRedirect({ preferredLanguage: code }), code === 'ru' ? null : `/${code}`);
  }
  assert.equal(preferredBrowserLanguage(['nl-NL', 'de-DE', 'en-US']), 'de');
  assert.equal(preferredBrowserLanguage(['pt_BR']), 'pt');
});
test('manual saved language wins over the English default, including Russian', () => {
  assert.equal(initialLanguageRedirect({ preferredLanguage: 'ru', browserLanguages: ['en-US'] }), null);
  assert.equal(initialLanguageRedirect({ preferredLanguage: 'fr', browserLanguages: ['en-US'] }), '/fr');
  assert.equal(initialLanguageRedirect({ preferredLanguage: 'invalid', browserLanguages: ['en-US'] }), '/en');
});
test('missing preferences, unavailable storage and invalid saved languages fall back to English', () => {
  for (const preferredLanguage of [undefined, null, '', 'ja', '__proto__', 'constructor']) {
    assert.equal(initialLanguageRedirect({ preferredLanguage }), '/en');
  }
});
test('explicit language links and canonical deep links are not redirected', () => {
  for (const pathname of ['/en', '/en/teams/empire', '/de/match/123', '/profile/name', '/teams/empire', '/auth/callback', '/admin', '/forum']) {
    assert.equal(initialLanguageRedirect({ pathname, preferredLanguage: 'fr', browserLanguages: ['en-US'] }), null);
  }
});
test('homepage navigation retains referral parameters, filters and fragments', () => {
  assert.equal(initialLanguageRedirect({ browserLanguages: ['en-US'], search: '?utm_source=youtube&division=Main', hash: '#matches' }), '/en?utm_source=youtube&division=Main#matches');
});
test('a manual Russian choice works even when storage is blocked', () => {
  assert.equal(initialLanguageRedirect({ search: '?ui_lang=ru', browserLanguages: ['en-US'] }), null);
  assert.equal(initialLanguageRedirect({ search: '?ui_lang=invalid', browserLanguages: ['en-US'] }), '/en?ui_lang=invalid');
});
test('the English default works with blocked storage without loading the Russian application', () => {
  const source = readFileSync('src/bootstrap.js', 'utf8').replace(/^import .*;\n/, '');
  const redirects = [];
  let imports = 0;
  const script = new Script(source, { importModuleDynamically() { imports += 1; throw new Error('Unexpected app load'); } });
  script.runInNewContext({
    initialLanguageRedirect,
    window: {
      localStorage: { getItem() { throw new Error('Storage blocked'); } },
      location: { pathname: '/', search: '?utm_source=shorts', hash: '#matches', replace: value => redirects.push(value) },
    },
  });
  assert.deepEqual(redirects, ['/en?utm_source=shorts#matches']);
  assert.equal(imports, 0);
});
