const LANG = /^\/(?:ru|en|de|pt|es|fr|it)(?=\/|$)/;
function internalPath(value) {
  const path = typeof value === 'string' ? value : value && typeof value.pathname === 'string'
    ? value.pathname + (value.search || '') + (value.hash || '') : null;
  if (!path || path.length > 2000 || !path.startsWith('/') || path.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(path)) return null;
  const result = path.replace(LANG, '') || '/';
  return result.startsWith('//') ? null : result;
}
export function isMatchPath(value) {
  const path = internalPath(value && typeof value === 'object' ? value.pathname : value);
  return Boolean(path && /^\/(?:match\/[^/?#]+(?:\/[^/?#]+)?|(?:teams|team)\/[^/?#]+\/matches\/[^/?#]+)\/?(?:[?#].*)?$/.test(path));
}
function backLabel(path) {
  const pathname = path.split(/[?#]/)[0];
  if (pathname === '/') return '← Back to Home';
  if (isMatchPath(path)) return '← Back to Match';
  if (/^\/(?:teams|team)\/[^/]+\/?$/.test(pathname)) return '← Back to Team';
  if (/^\/(?:calendar|tournaments?)(?:\/|$)/.test(pathname)) return '← Back to Calendar';
  return '← Back to Matches';
}
export function matchLinkState(to, location, state) {
  if (!isMatchPath(to)) return state;
  return { from: internalPath(location) || '/', ...state };
}
export function matchBackLink(state, fallbackTeamSlug) {
  const from = internalPath(state?.from);
  const to = from || (fallbackTeamSlug ? `/teams/${encodeURIComponent(fallbackTeamSlug)}/matches` : '/');
  return { to, label: backLabel(to) };
}
