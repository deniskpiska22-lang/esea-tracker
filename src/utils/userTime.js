// Preserve the browser's full regional tag (en-GB vs en-US), independently
// of the selected translation language and of the visitor's time zone.
export function getUserDateLocale(languages = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]) {
  for (const language of Array.isArray(languages) ? languages : []) {
    if (typeof language !== 'string' || !language.trim()) continue;
    try {
      const [locale] = Intl.getCanonicalLocales(language.trim());
      if (locale) return locale;
    } catch { /* Ignore malformed browser preference entries. */ }
  }
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

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

export function formatUserDateTime(value, options = {}, { locale = getUserDateLocale(), timeZone = getUserTimeZone(), showTimeZone = true } = {}) {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const text = formatter(locale, { ...options, timeZone, hourCycle: 'h23' }).format(date);
  return options.hour && showTimeZone ? `${text} ${getTimeZoneLabel(date, timeZone)}` : text;
}
