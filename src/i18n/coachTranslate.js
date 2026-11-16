import catalog from './coachCatalog.json' with { type: 'json' };
import { currentLanguage } from './languages.js';
import { translateText } from './translate.js';

export function coachTx(text, language = currentLanguage()) {
  return catalog[text]?.[language] || translateText(text, language);
}
