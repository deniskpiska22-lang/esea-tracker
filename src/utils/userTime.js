// Browser-only display policy. Stored instants remain UTC; presentation follows
// the visitor's device, independently of site language, IP or betting partner.
export function getUserDateLocale(languages = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]) {
  for (const language of Array.isArray(languages) ? languages : []) {
    if (typeof language !== 'string' || !language.trim()) continue;
    try { const [locale] = Intl.getCanonicalLocales(language.trim()); if (locale) return locale; } catch { /* Invalid preference. */ }
  }
  return Intl.DateTimeFormat().resolvedOptions().locale;
}
const formatters = new Map();
function formatter(locale, options) {
  const key = JSON.stringify([locale, Object.entries(options).sort(([a], [b]) => a.localeCompare(b))]);
  if (!formatters.has(key)) {
    if (formatters.size >= 128) formatters.delete(formatters.keys().next().value);
    formatters.set(key, new Intl.DateTimeFormat(locale, options));
  }
  return formatters.get(key);
}
let userZone, zoneCheckedAt = 0;
export function getUserTimeZone() {
  if (!userZone || Date.now() - zoneCheckedAt > 30000) {
    try { userZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { userZone = 'UTC'; }
    zoneCheckedAt = Date.now();
  }
  return userZone;
}
const calendarPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
export function calendarDateParts(value) {
  const parts = typeof value === 'string' && calendarPattern.exec(value);
  if (!parts) return null;
  const [, year, month, day] = parts.map(Number);
  const check = new Date(0);
  check.setUTCFullYear(year, month - 1, day); check.setUTCHours(12, 0, 0, 0);
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? { year, month, day, utc: check } : null;
}
export function parseUserDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const calendar = calendarDateParts(value);
  if (calendar) {
    const date = new Date(0); date.setFullYear(calendar.year, calendar.month - 1, calendar.day); date.setHours(0, 0, 0, 0);
    return date;
  }
  if (typeof value === 'string' && calendarPattern.test(value)) return null;
  let input = value;
  if (typeof input === 'number' || typeof input === 'string' && /^-?\d{9,13}$/.test(input)) {
    const number = Number(input); input = Math.abs(number) < 1e11 ? number * 1000 : number;
  } else if (typeof input === 'string') {
    input = input.trim().replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T');
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(input)) input += 'Z';
    else input = input.replace(/([+-]\d{2})$/, '$1:00');
  }
  const date = new Date(input);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function getTimeZoneLabel(value = new Date(), timeZone = getUserTimeZone()) {
  const date = parseUserDate(value);
  if (!date) return '';
  const locale = timeZone.startsWith('America/') ? 'en-US' : 'en-GB';
  return formatter(locale, { timeZone, timeZoneName: 'short' }).formatToParts(date)
    .find(part => part.type === 'timeZoneName')?.value || timeZone;
}
export function formatUserDateTime(value, options = {}, { showTimeZone = true } = {}) {
  const calendar = calendarDateParts(value);
  const locale = getUserDateLocale();
  // A birthday or a date bucket is a calendar label, not midnight UTC.
  if (calendar) {
    const dateOptions = Object.fromEntries(Object.entries(options).filter(([key]) =>
      ['year','month','day','weekday','era','dateStyle'].includes(key)));
    return formatter(locale, { ...dateOptions, timeZone: 'UTC' }).format(calendar.utc);
  }
  const date = parseUserDate(value);
  if (!date) return '';
  // Call sites cannot override the device's zone or its 12/24-hour convention.
  const safeOptions = Object.fromEntries(Object.entries(options).filter(([key]) =>
    !['timeZone','hour12','hourCycle','timeZoneName'].includes(key)));
  const timeZone = getUserTimeZone();
  const text = formatter(locale, { ...safeOptions, timeZone }).format(date);
  return (options.hour || options.timeStyle) && showTimeZone ? `${text} ${getTimeZoneLabel(date, timeZone)}` : text;
}
// Compatibility for odds components: partner selection never changes the clock.
export function formatOddsDateTime(value, options) { return formatUserDateTime(value, options); }

const listeners = new Set();
let snapshot = '', timer;
export function refreshUserTimeSettings() {
  zoneCheckedAt = 0; userZone = undefined;
  const now = new Date();
  const next = [getUserTimeZone(), getUserDateLocale(), now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(Date.now() / 60000)].join('|');
  if (next !== snapshot) { snapshot = next; for (const listener of listeners) listener(); }
  return snapshot;
}
export function getUserTimeSnapshot() { return snapshot || refreshUserTimeSettings(); }
export function subscribeUserTime(listener) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    timer = setInterval(refreshUserTimeSettings, 30000);
    window.addEventListener('focus', refreshUserTimeSettings);
    window.addEventListener('languagechange', refreshUserTimeSettings);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', refreshUserTimeSettings);
  }
  refreshUserTimeSettings();
  return () => {
    listeners.delete(listener);
    if (!listeners.size && typeof window !== 'undefined') {
      clearInterval(timer);
      window.removeEventListener('focus', refreshUserTimeSettings);
      window.removeEventListener('languagechange', refreshUserTimeSettings);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', refreshUserTimeSettings);
    }
  };
}
