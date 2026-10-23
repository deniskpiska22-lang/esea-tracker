import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import matches from '../src/data/matches.js';
import { buildHistoryArchive } from './lib/historyArchive.js';

export function historyArchivePlugin() {
  const stats = JSON.parse(readFileSync(new URL('../src/data/matchStatsCompact.json', import.meta.url), 'utf8'));
  const { groups, recent } = buildHistoryArchive(matches, stats);
  const fingerprint = createHash('sha256').update(JSON.stringify({ groups, recent })).digest('hex').slice(0, 16);
  const base = `/assets/history-${fingerprint}/`;
  const files = new Map([['recent.json', JSON.stringify(recent)]]);
  for (const [kind, buckets] of Object.entries(groups)) {
    // Empty buckets are valid too, including for newly discovered matches.
    for (let index = 0; index < 256; index++) {
      const key = index.toString(16).padStart(2, '0');
      files.set(`${kind}/${key}.json`, JSON.stringify(buckets[key] || {}));
    }
  }
  return {
    name: 'history-archive',
    resolveId(id) { if (id === 'virtual:history-archive') return '\0history-archive'; },
    load(id) { if (id === '\0history-archive') return `export default ${JSON.stringify(base)};`; },
    generateBundle() {
      for (const [name, source] of files) this.emitFile({ type: 'asset', fileName: base.slice(1) + name, source });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0];
        if (!path?.startsWith(base)) return next();
        const source = files.get(path.slice(base.length));
        if (source === undefined) return next();
        response.setHeader('Content-Type', 'application/json');
        response.end(source);
      });
    },
  };
}
