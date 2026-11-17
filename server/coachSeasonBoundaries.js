// Unknown rooms are never interpreted as an empty coach slot.
const known = match => match.known === true;
const has = (match, id) => known(match) && match.coaches.includes(id);

export function coachBoundaryPlan(matches, phase = 'boundaries', now = Date.now()) {
  if (!matches.length) return null;
  const usable = index => !known(matches[index]) && !(Date.parse(matches[index].retry_at) > now);
  for (const index of [...new Set([0, matches.length - 1])]) {
    if (usable(index)) return { index, reason: index === 0 ? 'first-match' : 'last-match' };
  }
  if (phase === 'endpoints') return null;
  const ids = [...new Set(matches.filter(known).flatMap(match => match.coaches))];
  for (const id of ids) {
    const indices = matches.flatMap((match, index) => has(match, id) ? [index] : []);
    const first = indices[0], last = indices.at(-1);
    const after = matches.findIndex((match, index) => index > last && known(match) && !has(match, id));
    const before = matches.findLastIndex((match, index) => index < first && known(match) && !has(match, id));
    // Move inward from a known absence: last empty, penultimate empty, etc.
    // Never use binary search: a coach may leave and return within a season.
    const departure = after >= 0 ? after - 1 : last + 1;
    const arrival = before >= 0 ? before + 1 : first - 1;
    for (const [index, reason] of [[departure, 'departure'], [arrival, 'arrival']]) {
      if (index >= 0 && index < matches.length && usable(index)) return { index, reason, coachId: id };
    }
  }
  // Empty endpoints cannot rule out a coach during the middle of the season.
  // Walk backwards as requested; this can require every match for empty teams.
  if (!ids.length) {
    for (let index = matches.length - 2; index > 0; index--) {
      if (usable(index)) return { index, reason: 'find-last-coached-match' };
    }
  }
  return null;
}

export function coachSeasonBounds(group) {
  const matches = group.matches;
  const ids = [...new Set(matches.filter(known).flatMap(match => match.coaches))];
  return ids.map(id => {
    const indices = matches.flatMap((match, index) => has(match, id) ? [index] : []);
    const first = indices[0], last = indices.at(-1);
    const prior = matches.slice(0, first).findLast(match => known(match) && !has(match, id));
    const next = matches.slice(last + 1).find(match => known(match) && !has(match, id));
    const evidence = {
      first: { id: matches[first].id, date: matches[first].date },
      last: { id: matches[last].id, date: matches[last].date },
      before: prior ? { id: prior.id, date: prior.date } : null,
      after: next ? { id: next.id, date: next.date } : null,
      hasGaps: matches.slice(first, last + 1).some(match => known(match) && !has(match, id)),
      unverifiedBetween: matches.slice(first, last + 1).filter(match => !known(match)).length,
      departureAdjacent: Boolean(last + 1 < matches.length && known(matches[last + 1]) && !has(matches[last + 1], id)),
    };
    return { team_id: group.team_id, season: group.season, coach_id: id, evidence };
  });
}
