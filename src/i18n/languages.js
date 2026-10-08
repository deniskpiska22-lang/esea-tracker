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
export function browserLanguage() {
  if (typeof navigator === 'undefined') return 'en';
  for (const value of navigator.languages || [navigator.language]) {
    const code = value.toLowerCase().split('-')[0];
    if (LANGUAGE_CODES.includes(code)) return code;
  }
  return 'en';
}
export function currentLanguage() {
  return typeof window === 'undefined' ? 'ru' : languageFromPath(window.location.pathname);
}
export function currentLocale() {
  return LANGUAGES.find(item => item.code === currentLanguage()).locale;
}
