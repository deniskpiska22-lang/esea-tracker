import coaches from '../data/coaches.json' with { type: 'json' };

export function listCoaches() {
  return coaches;
}

export function findCoach(slug) {
  return coaches.find(coach => coach.slug === slug?.toLowerCase());
}

export function coachesForTeam(teamId, entries = coaches) {
  if (!teamId) return { current: [], past: [] };
  const current = [];
  const past = [];
  for (const coach of entries) {
    const periods = coach.periods.filter(period => period.teamId === teamId);
    if (periods.some(period => period.status === 'current')) current.push(coach);
    else if (periods.some(period => period.status === 'past')) past.push(coach);
  }
  return { current, past };
}

export function coachingPeriodLabel(period, locale) {
  const format = value => new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', ...(value.length > 7 && { day: 'numeric' }), timeZone: 'UTC',
  }).format(new Date(value.length === 7 ? value + '-01' : value));
  return [period.from, period.to].filter(Boolean).map(format).join(' — ') || period.season || '';
}
