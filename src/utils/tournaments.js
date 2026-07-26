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
