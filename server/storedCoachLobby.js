import { uuid, finished } from './coachLobby.js';
import { validFaceitAvatar } from '../src/utils/teamAvatar.js';

export function storedCoachIds(payload) {
  return [...new Set((Array.isArray(payload?.factions) ? payload.factions : []).flatMap(side =>
    (Array.isArray(side.members) ? side.members : []).filter(member => member.role === 'GAME_ROLE_COACH'
      && uuid(member.user_id)).map(member => member.user_id)))];
}

export function parseStoredCoachLobby(payload, match, identities, checkedAt = new Date().toISOString()) {
  if (payload?.id !== match.id || payload.game !== 'cs2' || !finished(match.status) || !finished(payload.status)
    || !/^\s*(?:ESEA\s|S\d+\s+(?:EU|NA|SA|AF|AS|OCE)\s)/i.test(match.competition_name || '')
    || !Array.isArray(payload.factions) || payload.factions.length !== 2) return null;
  const expected = new Set([match.team1_id, match.team2_id]);
  const sides = payload.factions;
  if (expected.size !== 2 || !sides.every(side => uuid(side.premade_team_id) && expected.has(side.premade_team_id))
    || sides[0].premade_team_id === sides[1].premade_team_id) return null;
  const teams = [];
  for (const side of sides) {
    // Missing or unrecognized roles do not prove an empty coach slot.
    if (!Array.isArray(side.members) || !side.members.length || !side.members.every(member => uuid(member.user_id)
      && ['GAME_ROLE_PLAYER','GAME_ROLE_SUBSTITUTE','GAME_ROLE_COACH'].includes(member.role))) continue;
    const coaches = [...new Set(side.members.filter(member => member.role === 'GAME_ROLE_COACH').map(member => member.user_id))]
      .map(id => {
        const person = identities.get(id);
        if (!person?.nickname?.trim()) throw new Error('Missing coach identity: ' + id);
        return { id, nickname: person.nickname.trim(), country: /^[a-z]{2}$/i.test(person.country || '') ? person.country.toUpperCase() : null,
          avatar: validFaceitAvatar(person.avatar) };
      });
    teams.push({ id: side.premade_team_id, name: side.name || null,
      logo: validFaceitAvatar(side.avatar || side.logo), coaches, roster: [] });
  }
  if (teams.length !== 2) return null;
  return { match_id: match.id, teams, team_ids: teams.map(team => team.id),
    coach_ids: [...new Set(teams.flatMap(team => team.coaches.map(coach => coach.id)))],
    checked_at: checkedAt, retry_at: null, terminal: true };
}
