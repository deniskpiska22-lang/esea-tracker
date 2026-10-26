import { currentLocale } from '../i18n/languages.js';

const formatters = new Map();
function formatter(locale, options = {}) {
  const key = JSON.stringify([locale, Object.entries(options).sort(([a], [b]) => a.localeCompare(b))]);
  if (!formatters.has(key)) {
    if (formatters.size >= 64) formatters.delete(formatters.keys().next().value);
    formatters.set(key, new Intl.DateTimeFormat(locale, options));
  }
  return formatters.get(key);
}
let userZone;
let zoneCheckedAt = 0;
export function getUserTimeZone() {
  if (!userZone || Date.now() - zoneCheckedAt > 60000) {
    userZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    zoneCheckedAt = Date.now();
  }
  return userZone;
}

export function getTimeZoneLabel(date = new Date(), timeZone = getUserTimeZone()) {
  // English zone abbreviations stay recognizable regardless of the site language.
  const locale = timeZone.startsWith('America/') ? 'en-US' : 'en-GB';
  return formatter(locale, { timeZone, timeZoneName: 'short' })
    .formatToParts(date).find(part => part.type === 'timeZoneName')?.value || timeZone;
}

export function formatUserDateTime(value, options = {}, { locale = currentLocale(), timeZone = getUserTimeZone(), showTimeZone = true } = {}) {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const text = formatter(locale, { ...options, timeZone, hourCycle: 'h23' }).format(date);
  return options.hour && showTimeZone ? `${text} ${getTimeZoneLabel(date, timeZone)}` : text;
}
