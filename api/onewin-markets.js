import { getAdPolicy } from './ad-policy.js';
import { getOneWinConfig, getOneWinMarketEvents, getOneWinSnapshot } from '../server/onewinSource.js';
import { buildOneWinMarketUrl, buildOneWinMarketsCategoryUrl, extractOneWinMarket, isOpenCs2Market, MARKET_LANGUAGES, MARKET_TTL_MS } from '../src/utils/onewinMarkets.js';

export function createMarketsHandler({ loadEvents = getOneWinMarketEvents, loadSnapshot = getOneWinSnapshot, loadConfig = getOneWinConfig, now = Date.now } = {}) {
  return async (req, res) => {
    for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) res.setHeader(name, 'private, no-store, max-age=0');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
    if (!getAdPolicy(req.headers['x-vercel-ip-country']).adsEnabled) return res.status(200).json({ market: null });
    const language = req.query?.lang || 'en';
    const visit = req.query?.action === 'visit';
    const browse = req.query?.action === 'browse';
    if (!MARKET_LANGUAGES.includes(language) || (req.query?.action && !visit && !browse)
      || (visit && !/^[1-9]\d{0,9}$/.test(req.query?.eventId || ''))) return res.status(400).json({ market: null });
    try {
      if (browse) {
        const target = buildOneWinMarketsCategoryUrl((await loadConfig()).sourceOrigin);
        return target ? res.redirect(302, target) : res.status(503).end('Markets temporarily unavailable');
      }
      const events = (await loadEvents(language)).filter(event => isOpenCs2Market(event, now()))
        .filter(event => !visit || event.id === Number(req.query.eventId))
        .sort((left, right) => Number(left.endAt || left.startAt) - Number(right.endAt || right.startAt));
      // Bounded work, even if the public feed grows substantially.
      for (const event of events.slice(0, 3)) {
        const source = await loadSnapshot(event.id, language);
        const validForMs = MARKET_TTL_MS - (now() - source.fetchedAt);
        const answers = extractOneWinMarket(source.data, event);
        const target = buildOneWinMarketUrl(event);
        if (!answers || !target || !Number.isFinite(validForMs) || validForMs <= 0 || validForMs > MARKET_TTL_MS) continue;
        if (visit) return res.redirect(302, target);
        return res.status(200).json({ market: {
          eventId: event.id, ...answers, language,
          updatedAt: new Date(source.fetchedAt).toISOString(), validForMs,
          href: `/api/onewin-markets?lang=${language}&action=visit&eventId=${event.id}`,
        } });
      }
    } catch {
      // A category link remains available without inventing a question or prices.
    }
    if (visit) {
      try {
        const target = buildOneWinMarketsCategoryUrl((await loadConfig()).sourceOrigin);
        if (target) return res.redirect(302, target);
      } catch { /* Do not redirect to an unverified origin. */ }
    }
    return visit || browse ? res.status(503).end('Markets temporarily unavailable') : res.status(200).json({ market: null });
  };
}

export default createMarketsHandler();
