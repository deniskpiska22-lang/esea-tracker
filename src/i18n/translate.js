import catalog from './catalog.json' with { type: 'json' };
import russianAliases from './russianAliases.json' with { type: 'json' };
import { currentLanguage } from './languages.js';
export function translateText(value, language = currentLanguage()) {
  if (typeof value !== 'string') return value;
  const normalized = value.replace(/\s+/g, ' ').trim();
  const key = russianAliases[normalized] || normalized;
  const translated = language === 'en' ? key : catalog[key]?.[language];
  if (!translated) return value;
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  return leading + translated + trailing;
}
export const tx = translateText;
export function tf(template, ...values) {
  return translateText(template).replace(/\{(\d+)\}/g, (_, index) => values[Number(index)] ?? '');
}
