import axios from "axios";

export async function fetchTeamMatches(team) {
  if (!team.premade_team_id || !team.championship_id) return [];

  const url = `https://www.faceit.com/api/team-leagues/v2/matches`;
  const params = {
    championship_ids: team.championship_id,
    entityId: team.premade_team_id,
    entityType: "PREMADE_TEAM",
    status: "MATCH_STATUS_FINISHED",
    offset: 0,
    limit: 40
  };

  try {
    const response = await axios.get(url, { params });
    return response.data.payload || [];
  } catch (e) {
    console.error(`Ошибка при загрузке матчей для ${team.name}:`, e);
    return [];
  }
}