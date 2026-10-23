import { readFileSync } from 'node:fs';
import { LANGUAGE_CODES } from '../src/i18n/languages.js';

export function selectCatalogLanguage(catalog, language) {
  // Preserve every key, including untranslated entries and English error keys.
  return Object.fromEntries(Object.entries(catalog).map(([key, row]) => [key, {
    ...(row[language] === undefined ? {} : { [language]: row[language] }),
  }]));
}

export function localizedCatalogsPlugin() {
  const catalogs = Object.fromEntries(['catalog', 'forumCatalog', 'mapStatsCatalog'].map(name => [name,
    JSON.parse(readFileSync(new URL(`../src/i18n/${name}.json`, import.meta.url), 'utf8')),
  ]));
  return {
    name: 'localized-catalogs',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === './catalogs.js' && importer?.endsWith('/src/i18n/translate.js')) return '\0localized-catalogs';
      if (/^virtual:locale-(ru|en|de|pt|es|fr|it)$/.test(id)) return '\0' + id;
    },
    load(id) {
      if (id === '\0localized-catalogs') {
        const loaders = LANGUAGE_CODES.map(language => `${JSON.stringify(language)}:()=>import("virtual:locale-${language}")`).join(',');
        // Await before React mounts: no flash of English or changed text sizes.
        return `import {currentLanguage} from '/src/i18n/languages.js';
          const dictionaries = await ({${loaders}})[currentLanguage()]();
          export const catalog = dictionaries.catalog;
          export const forumCatalog = dictionaries.forumCatalog;
          export const mapStatsCatalog = dictionaries.mapStatsCatalog;`;
      }
      if (id.startsWith('\0virtual:locale-')) {
        const language = id.slice('\0virtual:locale-'.length);
        return Object.entries(catalogs).map(([name, catalog]) =>
          `export const ${name} = JSON.parse(${JSON.stringify(JSON.stringify(selectCatalogLanguage(catalog, language)))});`
        ).join('\n');
      }
    },
  };
}
