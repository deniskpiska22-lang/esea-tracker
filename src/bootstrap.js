import { initialLanguageRedirect } from './i18n/languages.js';

let preferredLanguage;
try { preferredLanguage = window.localStorage.getItem('esea-tracker-language'); } catch { /* Storage may be disabled. */ }
const destination = initialLanguageRedirect({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
  preferredLanguage,
});
if (destination) {
  // English is the default entrance. Decide before fetching the application
  // and dictionary, while preserving a language chosen manually.
  window.location.replace(destination);
} else {
  import('./main.jsx').catch(error => {
    console.error('Application entry could not load:', error);
    const recovery = document.getElementById('boot-recovery');
    if (recovery) recovery.style.display = 'block';
  });
}
