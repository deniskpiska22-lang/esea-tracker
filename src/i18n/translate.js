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
export function translateTournamentText(value) {
  const round = String(value || '').match(/^Round (\d+)$/i);
  if (round) return tf('Round {0}', round[1]);
  const group = String(value || '').match(/^Group (.+)$/i);
  if (group) return `${translateText('Group')} ${group[1]}`;
  return translateText(value);
}
export function translateBackLabel(value) {
  const team = String(value || '').match(/^← Back to (.+)$/);
  return team ? tf('← Back to {0}', team[1]) : translateText(value);
}
const localizedMessages = new Set(Object.values(catalog).flatMap(row => Object.values(row)));
export function translateError(value) {
  if (!value) return value;
  const message = String(value);
  if (localizedMessages.has(message.trim())) return message;
  const translated = translateText(message);
  if (translated !== message || catalog[message.trim()]) return translated;
  if (/Invalid login credentials/i.test(message)) return translateText('Incorrect username or password.');
  if (/Email not confirmed/i.test(message)) return translateText('Email not confirmed');
  if (/already registered/i.test(message)) return translateText('User already registered');
  if (/rate limit|too many requests/i.test(message)) return translateText('Too many requests. Please try again later.');
  return translateText('Could not complete the request. Please try again.');
}
