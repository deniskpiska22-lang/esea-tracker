import { createHash } from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { trafficMetadata } from '../server/trafficMetadata.js';
import { VISITOR_ID, trafficPath } from '../src/utils/siteTraffic.js';

export function createPresenceHandler({ record, now = Date.now }) {
  const recent = new Map();
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.method !== 'POST') return res.status(405).setHeader('Allow', 'POST').end();
    let origin;
    try { origin = new URL(req.headers.origin); } catch { return res.status(403).end(); }
    if (origin.host !== req.headers.host || req.headers['x-site-presence'] !== '1' || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) return res.status(403).end();
    if (/bot|spider|crawl|headless|prerender|curl|wget|lighthouse/i.test(req.headers['user-agent'] || '')) return res.status(204).end();
    const { visitorId, path, viewEvent } = req.body || {};
    const cleanPath = trafficPath(path);
    if (!VISITOR_ID.test(typeof visitorId === 'string' ? visitorId : '') || !cleanPath) return res.status(400).end();
    if (viewEvent != null && (!viewEvent || !VISITOR_ID.test(viewEvent.id || ''))) return res.status(400).end();
    const visitor = createHash('sha256').update(`esea-traffic-v1:${visitorId}`).digest('hex');
    const cacheKey = `${visitor}:${viewEvent?.id || cleanPath}`;
    const time = now();
    if (recent.has(cacheKey) && time - recent.get(cacheKey) < 15_000) return res.status(204).end();
    // Bounded cache also coalesces in-flight writes from separate browser tabs.
    if (recent.size >= 20_000) for (const [key, timestamp] of recent) {
      if (time - timestamp >= 15_000 || recent.size >= 20_000) recent.delete(key);
      if (recent.size < 10_000) break;
    }
    recent.set(cacheKey, time);
    const country = /^[A-Z]{2}$/.test(req.headers['x-vercel-ip-country'] || '') ? req.headers['x-vercel-ip-country'] : '';
    const agent = req.headers['user-agent'] || '';
    const device = /ipad|tablet/i.test(agent) ? 'tablet' : /mobile|android|iphone/i.test(agent) ? 'mobile' : 'desktop';
    try {
      await record({ p_visitor: visitor, p_path: cleanPath, p_country: country, p_device: device, ...(viewEvent ? { p_event: { id: viewEvent.id, ...trafficMetadata(agent, viewEvent.referrer, origin.host) } } : {}) });
      return res.status(204).end();
    } catch {
      recent.delete(cacheKey);
      return res.status(503).end();
    }
  };
}
let database;
export default createPresenceHandler({ record: async args => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Traffic database unavailable');
  database ||= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await database.rpc(args.p_event ? 'record_site_activity' : 'record_site_presence', args).abortSignal(AbortSignal.timeout(5000));
  if (error) throw error;
} });
