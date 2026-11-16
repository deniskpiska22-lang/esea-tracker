// FACEIT timestamps are seconds, while Date and some stored values use ms.
function timestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value < 1e12 ? value * 1000 : value;
  return typeof value === 'string' && value ? Date.parse(value) : NaN;
}

const completeEvent = status => ['FINISHED', 'COMPLETED', 'ENDED', 'CHAMPIONSHIP_STATUS_FINISHED'].includes(String(status).toUpperCase());
const completeMatch = status => ['FINISHED', 'MATCH_STATUS_FINISHED', 'CANCELLED', 'CANCELED', 'MATCH_STATUS_CANCELLED'].includes(String(status).toUpperCase());

export function resolveTournamentCompletion(meta, matches, existing, now = Date.now()) {
  // A between-round gap is not a finish. Only the source championship's
  // terminal state (or a previously verified completion) can certify it.
  if (existing && timestamp(existing) <= now) return existing;
  if (!completeEvent(meta?.status) || matches.some(match => !completeMatch(match.status))) return null;
  const finishes = matches.map(match => timestamp(match.finished_at)).filter(value => value > 0 && value <= now);
  return finishes.length ? new Date(Math.max(...finishes)).toISOString() : null;
}
