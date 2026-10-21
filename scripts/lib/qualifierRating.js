// Select only the small result fragment, not raw_data's player rosters/veto.
export const QUALIFIER_RATING_COLUMNS = "map_scores,rating_details:raw_data->detailed_results";

function isOneZero(first, second) {
  if (first == null || second == null) return false;
  const scores = [Number(first), Number(second)];
  return Math.max(...scores) === 1 && Math.min(...scores) === 0;
}

function mapScores(match) {
  const maps = Array.isArray(match.map_scores) ? match.map_scores : [];
  const details = match.rating_details ?? match.raw_data?.detailed_results;
  return [
    ...maps.map(map => [map.team1_score, map.team2_score]),
    ...(Array.isArray(details) ? details : []).map(map => [
      map.factions?.faction1?.score, map.factions?.faction2?.score,
    ]),
  ];
}

export function isUnplayedQualifierResult(match) {
  if (!["FINISHED", "MATCH_STATUS_FINISHED"].includes(match.status)) return false;
  if (!/(qualif|karsinta|квалиф)/i.test(match.competition_name || "")) return false;

  const maps = mapScores(match);
  // FACEIT also exposes technical map results in otherwise complete series.
  if (maps.some(([first, second]) => isOneZero(first, second))) return true;
  if (!isOneZero(match.team1_score, match.team2_score)) return false;

  // A BO3/BO5 finished at 1:0 is incomplete. In BO1, however, 1:0 may
  // simply be the series score of a real map. Keep that match if actual
  // CS2 round scores are available (including a legitimate 13:0).
  if (Number(match.best_of) > 1) return true;
  const hasPlayedMap = maps.some(([first, second]) =>
    first != null && second != null &&
    Number.isFinite(Number(first)) && Number.isFinite(Number(second)) &&
    Math.min(Number(first), Number(second)) >= 0 &&
    Math.max(Number(first), Number(second)) >= 13
  );
  // started_at is not proof of play: FACEIT sets it on forfeited rooms too.
  // Missing statistics alone never excludes an ordinary round-score result.
  return !hasPlayedMap;
}
