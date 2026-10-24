import { initialLanguageRedirect } from './i18n/languages.js';

let preferredLanguage;
try { preferredLanguage = window.localStorage.getItem('esea-tracker-language'); } catch { /* Storage may be disabled. */ }
const destination = initialLanguageRedirect({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
  preferredLanguage,
  browserLanguages: navigator.languages?.length ? navigator.languages : [navigator.language],
});
if (destination) {
  // Decide before fetching React and a locale dictionary, so first-time
  // visitors do not load the entire Russian app before being sent to English.
  window.location.replace(destination);
} else {
  import('./main.jsx').catch(error => {
    console.error('Application entry could not load:', error);
    const recovery = document.getElementById('boot-recovery');
    if (recovery) recovery.style.display = 'block';
  });
}
