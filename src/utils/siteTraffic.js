export const PRESENCE_INTERVAL_MS = 20_000;
export const VISITOR_KEY = 'esea.visitor.v1';
export const PULSE_KEY = 'esea.presence.v1';
export const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function trafficPath(value) {
  // eslint-disable-next-line no-control-regex -- Control characters must not reach stored paths.
  if (typeof value !== 'string' || value.length > 240 || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(value)) return null;
  const path = value.split(/[?#]/, 1)[0];
  // Never store account, authentication or administrator URLs.
  if (/^\/(?:en|ru|de|pt|es|fr|it)\//.test(path)) return trafficPath(path.replace(/^\/[a-z]{2}(?=\/)/, '')) ? path : null;
  if (/^\/(?:admin|login|register|auth|settings|profile|reset-password|forgot-password)(?:\/|$)/i.test(path)) return null;
  return path;
}

export const TRAFFIC_PERIODS = [7, 14, 30];
export function trafficPeriod(value) {
  return TRAFFIC_PERIODS.includes(Number(value)) ? Number(value) : 14;
}
export function trafficPeriodSummary(data, value) {
  const period = trafficPeriod(value);
  const key = { 7: 'week', 14: 'fortnight', 30: 'month' }[period];
  return { period, label: { 7: 'Visitors in 7 days', 14: 'Visitors in 14 days', 30: 'Visitors in 30 days' }[period], value: data?.[key], days: (data?.days || []).slice(-period) };
}
