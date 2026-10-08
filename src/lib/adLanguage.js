export const AD_LANGUAGES = ['ru', 'en', 'pt', 'es', 'fr', 'az', 'ar', 'id', 'tr', 'uz', 'uk'];

export function selectAdLanguage(siteLanguage, explicitChoice, browserLanguages = []) {
  if (explicitChoice) return AD_LANGUAGES.includes(siteLanguage) ? siteLanguage : 'en';
  for (const value of browserLanguages) {
    const code = String(value).toLowerCase().split(/[-_]/)[0];
    if (AD_LANGUAGES.includes(code)) return code;
    // Respect a primary German/Italian preference; those creatives are absent.
    if (['de', 'it'].includes(code)) return 'en';
  }
  return AD_LANGUAGES.includes(siteLanguage) ? siteLanguage : 'en';
}
