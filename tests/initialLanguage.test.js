import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { initialLanguageRedirect, preferredBrowserLanguage } from '../src/i18n/languages.js';

test('a first-time American visitor enters the English site instead of the Russian default', () => {
  assert.equal(initialLanguageRedirect({ browserLanguages: ['en-US', 'en', 'ru'] }), '/en');
  assert.equal(initialLanguageRedirect({ browserLanguages: ['en-US'] }), '/en');
});
test('all seven supported browser languages are respected in preference order', () => {
  for (const code of ['ru', 'en', 'de', 'pt', 'es', 'fr', 'it']) {
    assert.equal(preferredBrowserLanguage([`${code.toUpperCase()}-XX`, 'en']), code);
    assert.equal(initialLanguageRedirect({ browserLanguages: [code] }), code === 'ru' ? null : `/${code}`);
  }
  assert.equal(preferredBrowserLanguage(['nl-NL', 'de-DE', 'en-US']), 'de');
  assert.equal(preferredBrowserLanguage(['pt_BR']), 'pt');
});
test('manual saved language wins over the browser, including Russian', () => {
  assert.equal(initialLanguageRedirect({ preferredLanguage: 'ru', browserLanguages: ['en-US'] }), null);
  assert.equal(initialLanguageRedirect({ preferredLanguage: 'fr', browserLanguages: ['en-US'] }), '/fr');
  assert.equal(initialLanguageRedirect({ preferredLanguage: 'invalid', browserLanguages: ['en-US'] }), '/en');
});
test('missing preferences, unavailable storage and unsupported languages fall back to English', () => {
  for (const browserLanguages of [[], undefined, null, ['ja-JP'], [null, 15, ''], ['__proto__']]) {
    assert.equal(initialLanguageRedirect({ browserLanguages }), '/en');
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
test('first-visit negotiation redirects even with blocked storage, without loading the application', () => {
  const source = readFileSync('src/bootstrap.js', 'utf8').replace(/^import .*;\n/, '');
  const redirects = [];
  let imports = 0;
  const script = new Script(source, { importModuleDynamically() { imports += 1; throw new Error('Unexpected app load'); } });
  script.runInNewContext({
    initialLanguageRedirect,
    navigator: { languages: ['en-US'] },
    window: {
      localStorage: { getItem() { throw new Error('Storage blocked'); } },
      location: { pathname: '/', search: '?utm_source=shorts', hash: '#matches', replace: value => redirects.push(value) },
    },
  });
  assert.deepEqual(redirects, ['/en?utm_source=shorts#matches']);
  assert.equal(imports, 0);
});
