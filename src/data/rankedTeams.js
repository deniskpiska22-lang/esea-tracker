import teams from "./teams";
import {
  getInitialPoints,
  getRankingStatus,
} from "../utils/teamRating";

/**
 * Подготавливает команды для таблицы рейтинга.
 *
 * Если points уже есть — сохраняет их.
 * Если points отсутствуют — назначает стартовые по дивизиону.
 */
const rankedTeams = teams
  .map((team) => {
    const savedPoints = Number(team.points ?? team.rating);

    const points = Number.isFinite(savedPoints)
      ? savedPoints
      : getInitialPoints(team.division);

    const matchesPlayed = Number(
      team.rating_matches_played ??
      team.matchesPlayed ??
      team.matches ??
      0,
    );

    return {
      ...team,

      points,

      // Временно оставляем для старых компонентов,
      // которые читают поле rating
      rating: points,

      rating_matches_played: matchesPlayed,

      ranking_status:
        team.ranking_status ??
        getRankingStatus(matchesPlayed),
    };
  })
  .sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    return (
      b.rating_matches_played -
      a.rating_matches_played
    );
  })
  .map((team, index) => ({
    ...team,
    rank: index + 1,
  }));

export default rankedTeams;