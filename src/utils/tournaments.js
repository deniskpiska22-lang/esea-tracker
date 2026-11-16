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
  const start = Date.parse(tournament?.startDate);
  // Calendar dates include the whole final day, including one-day qualifiers.
  const endValue = /^\d{4}-\d{2}-\d{2}$/.test(tournament?.endDate || "")
    ? `${tournament.endDate}T23:59:59.999Z`
    : tournament?.endDate;
  const end = Date.parse(endValue);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "upcoming";
  }

  if (now >= start && now <= end) return "live";
  if (now < start) return "upcoming";

  return "finished";
}
