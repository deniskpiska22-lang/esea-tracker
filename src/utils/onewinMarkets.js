import { isOneWinSourceOrigin } from './onewinMatch.js';

export const MARKET_LANGUAGES = ['ru', 'en', 'de', 'pt', 'es', 'fr', 'it'];
export const MARKET_TTL_MS = 60_000;

export function isOpenCs2Market(event, now = Date.now()) {
  const deadline = Number(event?.endAt || event?.startAt) * 1000;
  return Number.isSafeInteger(event?.id) && event.id > 0
    && event?.sport?.sportType === 'polybet'
    && event?.category?.slug === 'cybersport'
    && event?.tournament?.slug === 'counter-strike'
    && ['prematch', 'live'].includes(event?.serviceV2)
    && typeof event?.name === 'string' && event.name.trim().length > 0 && event.name.length <= 240
    && /^[a-z0-9-]{1,180}$/i.test(event?.slug || '')
    && Number.isFinite(deadline) && deadline > now;
}

export function buildOneWinMarketUrl(event) {
  if (!Number.isSafeInteger(event?.id) || event.id <= 0 || !/^[a-z0-9-]{1,180}$/i.test(event.slug || '')) return null;
  if (!isOneWinSourceOrigin(event.sourceOrigin)) return null;
  const url = new URL(`/betting/markets/event/${event.slug}-${event.id}`, event.sourceOrigin);
  url.searchParams.set('p', 'g39d');
  return url.href;
}

export function extractOneWinMarket(snapshot, event) {
  if (!event || !snapshot || snapshot.matchId !== event.id || snapshot.blocked || !Array.isArray(snapshot.oddsGroups)) return null;
  // Bind by the provider's event ID. Feed and snapshot translations can differ
  // (e.g. "trade-ups" versus "échanges"). One base group keeps outright-winner
  // candidate markets from being mistaken for a single binary question.
  const baseGroups = snapshot.oddsGroups.filter(group => group.isBase);
  if (baseGroups.length !== 1) return null;
  const groups = baseGroups.filter(group => !group.blocked
    && typeof group.name === 'string' && group.name.trim().length > 0 && group.name.length <= 240
    && group.oddsList?.length === 2
    && ['yes', 'no'].every(outcome => group.oddsList.filter(odd => odd.outcome === outcome).length === 1));
  if (groups.length !== 1) return null;
  const yes = groups[0].oddsList.find(odd => odd.outcome === 'yes');
  const no = groups[0].oddsList.find(odd => odd.outcome === 'no');
  if ([yes, no].some(odd => odd.status !== 1 || !Number.isFinite(odd.cf) || odd.cf <= 1
    || !Number.isFinite(odd.probability) || odd.probability < 0 || odd.probability > 100)) return null;
  if (Math.abs(yes.probability + no.probability - 100) > 2) return null;
  return { title: groups[0].name.trim(), yes: Math.round(yes.probability), no: Math.round(no.probability) };
}
