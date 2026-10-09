import { currentLocale } from '../i18n/languages.js';

export function getUserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getTimeZoneLabel(date = new Date(), timeZone = getUserTimeZone()) {
  // English zone abbreviations stay recognizable regardless of the site language.
  const locale = timeZone.startsWith('America/') ? 'en-US' : 'en-GB';
  return new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' })
    .formatToParts(date).find(part => part.type === 'timeZoneName')?.value || timeZone;
}

export function formatUserDateTime(value, options = {}, { locale = currentLocale(), timeZone = getUserTimeZone(), showTimeZone = true } = {}) {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const text = new Intl.DateTimeFormat(locale, { ...options, timeZone, hourCycle: 'h23' }).format(date);
  return options.hour && showTimeZone ? `${text} ${getTimeZoneLabel(date, timeZone)}` : text;
}
