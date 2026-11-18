import { lifecycleStatus } from './tournamentLifecycle.js';
import { parseUserDate, calendarDateParts } from './userTime.js';
import tournaments from "../data/tournaments.js";

function normalizeTournamentName(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Only tournaments we've actually imported (src/data/tournaments.generated.json)
// match here — a regular ESEA season name like "S58 EU Main B - Regular
// Season" simply won't be found, so it stays plain text everywhere without
// any extra scoping logic needed at the call sites.
export function findTournamentByName(name) {
  if (!name) return null;

  const normalized = normalizeTournamentName(name);

  return (
    tournaments.find(
      (tournament) => normalizeTournamentName(tournament.name) === normalized
    ) || null
  );
}

export function getTournamentStatus(tournament, now = Date.now()) {
  const completed = Date.parse(tournament?.completedAt);
  if (Number.isFinite(completed) && completed <= now) return "finished";
  const start = parseUserDate(tournament?.startDate)?.getTime() ?? NaN;
  const parsedEnd = parseUserDate(tournament?.endDate);
  const endDate = parsedEnd && new Date(parsedEnd.getTime());
  // A date-only tournament ends at the visitor's local end of that calendar day.
  if (endDate && calendarDateParts(tournament?.endDate)) endDate.setHours(23, 59, 59, 999);
  const end = endDate?.getTime() ?? NaN;
  const lifecycle = lifecycleStatus(tournament, now);
  if (lifecycle === "finished") return lifecycle;
  if (Number.isFinite(start) && now < start) return "upcoming";
  if (lifecycle) return lifecycle;

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "upcoming";
  }

  if (now >= start && now <= end) return "live";
  if (now < start) return "upcoming";

  return "finished";
}
