export const LANGUAGES = [
  { code: 'ru', name: 'Русский', locale: 'ru-RU', og: 'ru_RU' },
  { code: 'en', name: 'English', locale: 'en-US', og: 'en_US' },
  { code: 'de', name: 'Deutsch', locale: 'de-DE', og: 'de_DE' },
  { code: 'pt', name: 'Português', locale: 'pt-BR', og: 'pt_BR' },
  { code: 'es', name: 'Español', locale: 'es-ES', og: 'es_ES' },
  { code: 'fr', name: 'Français', locale: 'fr-FR', og: 'fr_FR' },
  { code: 'it', name: 'Italiano', locale: 'it-IT', og: 'it_IT' },
];
export const LANGUAGE_CODES = LANGUAGES.map(item => item.code);
export function languageFromPath(pathname = '/') {
  const first = pathname.split('/')[1];
  return LANGUAGE_CODES.includes(first) ? first : 'ru';
}
export function stripLanguage(pathname = '/') {
  return /^\/(ru|en|de|pt|es|fr|it)(?=\/|$)/.test(pathname)
    ? pathname.replace(/^\/(ru|en|de|pt|es|fr|it)(?=\/|$)/, '') || '/' : pathname;
}
export function localizedPath(pathname, language) {
  const path = stripLanguage(pathname || '/');
  return language === 'ru' ? path : `/${language}${path === '/' ? '' : path}`;
}
export function preferredBrowserLanguage(values = []) {
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== 'string') continue;
    const code = value.trim().toLowerCase().split(/[-_]/)[0];
    if (LANGUAGE_CODES.includes(code)) return code;
  }
  return 'en';
}
export function browserLanguage() {
  if (typeof navigator === 'undefined') return 'en';
  return preferredBrowserLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
}
export function initialLanguageRedirect({ pathname = '/', search = '', hash = '', preferredLanguage } = {}) {
  // The root is the language-neutral entrance. Localized links and existing
  // canonical entity URLs keep their language, including the Russian URLs.
  if (pathname !== '/') return null;
  const explicit = new URLSearchParams(search).get('ui_lang');
  const language = LANGUAGE_CODES.includes(explicit) ? explicit
    : LANGUAGE_CODES.includes(preferredLanguage) ? preferredLanguage
      : 'en';
  return language === 'ru' ? null : localizedPath('/', language) + search + hash;
}
export function currentLanguage() {
  return typeof window === 'undefined' ? 'ru' : languageFromPath(window.location.pathname);
}
export function currentLocale() {
  return LANGUAGES.find(item => item.code === currentLanguage()).locale;
}
