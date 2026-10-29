// Coarse categories only: never persist full user agents or referrer paths/queries.
export function trafficMetadata(agent = '', referrer = '', ownHost = '') {
  const browser = /Edg\//i.test(agent) ? 'Edge' : /OPR\/|Opera/i.test(agent) ? 'Opera' : /SamsungBrowser/i.test(agent) ? 'Samsung Internet' : /Firefox|FxiOS/i.test(agent) ? 'Firefox' : /Chrome|CriOS/i.test(agent) ? 'Chrome' : /Safari/i.test(agent) ? 'Safari' : 'Other';
  const os = /Android/i.test(agent) ? 'Android' : /iPhone|iPad|iPod/i.test(agent) ? 'iOS' : /Windows/i.test(agent) ? 'Windows' : /Macintosh|Mac OS X/i.test(agent) ? 'macOS' : /Linux/i.test(agent) ? 'Linux' : 'Other';
  let source = '';
  try {
    const url = new URL(typeof referrer === 'string' && referrer.length <= 2048 ? referrer : '');
    if (['http:', 'https:'].includes(url.protocol) && url.hostname.length <= 253 && url.host.replace(/^www\./, '') !== ownHost.replace(/^www\./, '') && !url.username && !url.password) source = url.hostname.toLowerCase();
  } catch { /* Missing or withheld referrer means direct/unknown. */ }
  return { browser, os, source };
}
