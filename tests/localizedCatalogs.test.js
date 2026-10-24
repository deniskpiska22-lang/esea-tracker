import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { localizedCatalogsPlugin } from '../scripts/viteLocalizedCatalogs.js';
import { LANGUAGE_CODES } from '../src/i18n/languages.js';

test('built browser dictionaries preserve every current-language translation and error key', async () => {
  const plugin = localizedCatalogsPlugin();
  const names = ['catalog', 'forumCatalog', 'mapStatsCatalog', 'adminCatalog'];
  const originals = Object.fromEntries(names.map(name => [name, JSON.parse(readFileSync(new URL(`../src/i18n/${name}.json`, import.meta.url), 'utf8'))]));
  for (const language of LANGUAGE_CODES) {
    const id = plugin.resolveId(`virtual:locale-${language}`);
    const source = plugin.load(id);
    const dictionaries = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    for (const name of names) {
      assert.deepEqual(Object.keys(dictionaries[name]), Object.keys(originals[name]));
      for (const [key, row] of Object.entries(originals[name])) {
        assert.equal(dictionaries[name][key][language], row[language]);
        assert.ok(Object.keys(dictionaries[name][key]).every(code => code === language));
      }
    }
  }
});

test('browser catalog loader awaits exactly the language selected by the URL', async () => {
  const plugin = localizedCatalogsPlugin();
  for (const language of LANGUAGE_CODES) {
    let source = plugin.load(plugin.resolveId('./catalogs.js', '/project/src/i18n/translate.js'));
    const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
    source = source.replace("'/src/i18n/languages.js'", JSON.stringify(moduleUrl(`export const currentLanguage = () => ${JSON.stringify(language)}`)));
    for (const code of LANGUAGE_CODES) {
      const fixture = `export const catalog = {language:${JSON.stringify(code)}};export const forumCatalog={};export const mapStatsCatalog={};export const adminCatalog={};`;
      source = source.replace(JSON.stringify(`virtual:locale-${code}`), JSON.stringify(moduleUrl(fixture)));
    }
    const dictionaries = await import(moduleUrl(source));
    assert.equal(dictionaries.catalog.language, language);
  }
  assert.equal(plugin.resolveId('./catalogs.js', '/server/renderSeo.js'), undefined);
});
