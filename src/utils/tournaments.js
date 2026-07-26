import tournaments from "../data/tournaments";

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

export function getTournamentStatus(tournament) {
  const start = new Date(tournament?.startDate).getTime();
  const end = new Date(tournament?.endDate).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "upcoming";
  }

  const now = Date.now();

  if (now >= start && now <= end) return "live";
  if (now < start) return "upcoming";

  return "finished";
}
