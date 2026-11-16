import { currentLanguage, localizedPath } from '../i18n/languages.js';
import { alternateLanguages } from '../i18n/seo.js';
import { coachTx } from '../i18n/coachTranslate.js';
import { playerRolePath } from './profileRoles.js';

export function getCoachSeo(id, profile, language = currentLanguage(), missing = false) {
  const canonicalPath = localizedPath(profile?.playerNickname ? playerRolePath(profile.playerNickname) : `/coach/${encodeURIComponent(id)}`, language);
  const label = coachTx('Coach profile', language);
  const heading = profile?.nickname ? `${profile.nickname} — ${coachTx('Coach', language)}`
    : missing ? coachTx('Coach profile not found', language) : label;
  return {
    language, canonicalPath, heading, title: `${heading} | ESEA Tracker`,
    description: [profile?.nickname, label, 'ESEA CS2', coachTx('Team history', language)].filter(Boolean).join(' · '),
    alternates: profile ? alternateLanguages(canonicalPath) : [],
    robots: profile ? undefined : 'noindex,follow',
    image: profile?.avatar,
  };
}
