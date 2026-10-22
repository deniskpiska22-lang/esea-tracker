import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { getAdPolicy } from './ad-policy.js';
import { getOneWinEvents, getOneWinSnapshot } from '../server/onewinSource.js';
import { buildOneWinMatchUrl, extractOneWinWinner, findOneWinMatch, isOddsMatchActive, orientOneWinOdds, ONEWIN_ODDS_TTL_MS } from '../src/utils/onewinMatch.js';

export function createMatchOddsHandler({ loadMatch, loadEvents = getOneWinEvents, loadSnapshot = getOneWinSnapshot, now = Date.now }) {
  return async (req, res) => {
    for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) res.setHeader(name, 'private, no-store, max-age=0');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
    if (!getAdPolicy(req.headers['x-vercel-ip-country']).adsEnabled) return res.status(200).json({ odds: null });
    const id = req.query?.matchId;
    if (typeof id !== 'string' || !/^(?:1-)?[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return res.status(400).json({ odds: null });
    if (req.query.action && req.query.action !== 'visit') return res.status(400).json({ odds: null });
    try {
      const match = await loadMatch(id);
      if (!match || !isOddsMatchActive(match)) return res.status(200).json({ odds: null });
      const live = !['SCHEDULED', 'MATCH_STATUS_SCHEDULED'].includes(String(match.status).toUpperCase());
      const events = await loadEvents(live ? 'live' : 'prematch');
      const event = findOneWinMatch(match, events);
      if (!event) return res.status(200).json({ odds: null });
      const snapshot = await loadSnapshot(event.id);
      const prices = extractOneWinWinner(snapshot.data, event);
      const validForMs = ONEWIN_ODDS_TTL_MS - (now() - snapshot.fetchedAt);
      const target = buildOneWinMatchUrl(event);
      if (!prices || !target || !Number.isFinite(validForMs) || validForMs <= 0 || validForMs > ONEWIN_ODDS_TTL_MS) return res.status(200).json({ odds: null });
      if (req.query.action === 'visit') return res.redirect(302, target);
      const oriented = orientOneWinOdds(match, event, prices);
      return res.status(200).json({ odds: {
        matchId: match.id, eventId: event.id, provider: '1win', live,
        team1: { name: match.team1_name, price: oriented.team1 },
        team2: { name: match.team2_name, price: oriented.team2 },
        updatedAt: new Date(snapshot.fetchedAt).toISOString(), validForMs,
        href: `/api/match-odds?matchId=${encodeURIComponent(match.id)}&action=visit`,
      } });
    } catch (error) {
      console.warn('Match odds unavailable:', error instanceof Error ? error.message : 'source error');
      return res.status(200).json({ odds: null });
    }
  };
}

export default createMatchOddsHandler({ loadMatch: async id => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Match database is not configured');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from('matches').select('id,status,scheduled_at,team1_name,team2_name')
    .eq('id', id).abortSignal(AbortSignal.timeout(5000)).maybeSingle();
  if (error) throw new Error('Match lookup failed');
  return data;
} });
