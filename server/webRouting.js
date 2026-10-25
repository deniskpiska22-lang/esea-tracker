// Keep the Railway routing contract in sync with the existing Vercel deployment.
import { readFile } from 'node:fs/promises';

export const hostingRoutes = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

export function compileRoute(source) {
  if (source === '/(.*)') return /^\/.*$/;
  let pattern = '';
  for (let index = 0; index < source.length;) {
    if (source[index] !== ':') {
      pattern += source[index++].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      continue;
    }
    const name = source.slice(++index).match(/^\w+/)?.[0];
    if (!name) throw new Error(`Invalid route: ${source}`);
    index += name.length;
    let expression = '[^/]+';
    if (source[index] === '(') {
      const end = source.indexOf(')', index);
      if (end < 0) throw new Error(`Invalid route: ${source}`);
      expression = source.slice(index + 1, end);
      index = end + 1;
    }
    const modifier = source[index];
    if (modifier === '*' || modifier === '?') {
      index++;
      if (pattern.endsWith('/')) {
        pattern = pattern.slice(0, -1) + `(?:/(?<${name}>${modifier === '*' ? '.*' : expression}))?`;
      } else pattern += `(?<${name}>${expression})?`;
    } else pattern += `(?<${name}>${expression})`;
  }
  return new RegExp(`^${pattern}/?$`);
}

export function interpolate(destination, groups = {}) {
  // Groups are still URL encoded. In particular, keep encoded slashes inside IDs.
  return destination.replace(/:(\w+)\*?/g, (_, name) => groups[name] || '');
}

export const redirects = hostingRoutes.redirects.map(route => ({ ...route, match: compileRoute(route.source) }));
export const headers = hostingRoutes.headers.map(route => ({ ...route, match: compileRoute(route.source) }));
export const rewrites = hostingRoutes.rewrites.filter(route => route.source !== '/(.*)').map(route => ({ ...route, match: compileRoute(route.source) }));

export function resolveRewrite(pathname, search) {
  for (const route of rewrites) {
    const match = route.match.exec(pathname);
    if (!match) continue;
    const target = new URL(interpolate(route.destination, match.groups), 'http://internal');
    const query = new URLSearchParams(search);
    for (const [key, value] of target.searchParams) query.set(key, value);
    return { pathname: target.pathname, query: Object.fromEntries(query) };
  }
  return null;
}
