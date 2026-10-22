import { seoClient } from '../server/seoData.js';
import { loadTeamMapData } from '../server/teamMapData.js';

export function createTeamMapHandler(load) {
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') return res.status(405).end();
    const key = req.query?.team;
    if (typeof key !== 'string' || !key.trim() || key.length > 150) return res.status(400).json({ ok: false });
    try {
      const data = await load(key);
      if (!data) { res.setHeader('Cache-Control', 'no-store'); return res.status(404).json({ ok: false }); }
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
      return res.status(200).json({ ok: true, ...data });
    } catch (error) {
      console.error('Team map history unavailable:', error.message);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ ok: false });
    }
  };
}

export default createTeamMapHandler(key => loadTeamMapData(seoClient(), key));
