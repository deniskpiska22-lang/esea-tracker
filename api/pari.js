import { getAdPolicy } from './ad-policy.js';

const PLACEMENTS = new Set(['team_profile_native', 'match_room_native']);
export default function handler(req, res) {
  for (const key of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) res.setHeader(key, 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).setHeader('Allow', 'GET, HEAD').end();
  if (!getAdPolicy(req.headers['x-vercel-ip-country']).pariEnabled) return res.status(403).end('Unavailable');
  const placement = PLACEMENTS.has(req.query?.placement) ? req.query.placement : 'team_profile_native';
  const target = new URL('https://clicks.af-pb06e2.com/click');
  target.search = new URLSearchParams({ offer_id: '812', partner_id: '34440', landing_id: '88',
    utm_medium: 'affiliate', utm_source: 'esea_tracker', utm_campaign: 'pari_cs2_test', utm_content: placement }).toString();
  return res.redirect(302, target.href);
}
