// Node/SEO rendering can translate every language synchronously. Vite replaces
// this import in the browser with the dictionary for the current URL language.
export { default as catalog } from './catalog.json' with { type: 'json' };
export { default as forumCatalog } from './forumCatalog.json' with { type: 'json' };
export { default as mapStatsCatalog } from './mapStatsCatalog.json' with { type: 'json' };
