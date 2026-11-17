import { uuid } from '../../server/coachLobby.js';

export const ESEA_LEAGUE_ID = 'a14b8616-45b9-4581-8637-4dfd0b5f6af8';

export function parseLeagueCoachRoster(payload, expected) {
  if (!Array.isArray(payload?.payload)) throw new Error('Malformed active-team response');
  const entries = payload.payload.filter(row => row.team?.premade_team_id === expected.team_id
    && row.team?.id === expected.team.leagueTeamId && row.team?.league_id === ESEA_LEAGUE_ID);
  if (!entries.length) return null;
  if (entries.length !== 1 || !Array.isArray(entries[0].members)) throw new Error('Ambiguous league roster');
  const { team, members } = entries[0];
  const coaches = members.filter(member => member.game_role === 'coach' && !member.ended_at && !member.ended_at_reason);
  if (coaches.length > 1) throw new Error('Multiple active coaches in one league roster');
  const coach = coaches[0];
  if (coach && (!uuid(coach.user_id) || coach.league_team_id !== team.id || coach.premade_team_id !== team.premade_team_id)) {
    throw new Error('Coach and league team identities differ');
  }
  return { teamId: team.premade_team_id, coachId: coach?.user_id || null,
    startedAt: coach?.started_at && Number.isFinite(Date.parse(coach.started_at)) ? coach.started_at : null };
}
