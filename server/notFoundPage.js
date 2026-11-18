import { languageFromPath, localizedPath } from '../src/i18n/languages.js';
import { translateText } from '../src/i18n/translate.js';
export function notFoundPage(pathname) {
  const lang = languageFromPath(pathname);
  const tx = text => translateText(text, lang).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>404 · ${tx('Page not found')} | ESEA Tracker</title><style>body{margin:0;background:#090d12;color:#eef4fa;font:16px system-ui;text-align:center}main{max-width:700px;margin:12vh auto;padding:24px}a{display:inline-block;padding:14px 24px;border-radius:12px;background:#ff8500;color:#111;text-decoration:none;font-weight:700}p{color:#a1b0c1}</style></head><body><main><p>ESEA Tracker · 404</p><h1>${tx('Page not found')}</h1><p>${tx('This page is unavailable.')}</p><a href="${localizedPath('/',lang)}">${tx('← Back to Home')}</a></main></body></html>`;
}
