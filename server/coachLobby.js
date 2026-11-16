import { validFaceitAvatar } from '../src/utils/teamAvatar.js';

export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const finished = status => ['FINISHED', 'MATCH_STATUS_FINISHED'].includes(status);
export const upcoming = status => ['SCHEDULED','MATCH_STATUS_SCHEDULED','READY','MATCH_STATUS_READY','ONGOING',
  'MATCH_STATUS_ONGOING','LIVE','MATCH_STATUS_LIVE','CONFIGURING','MATCH_STATUS_CONFIGURING','ADJUSTMENT','MATCH_STATUS_ADJUSTMENT'].includes(status);
export const matchId = value => typeof value === 'string' && (uuid(value) || /^\d+$/.test(value.split('-')[0]) && uuid(value.slice(value.indexOf('-') + 1)));
const title = value => typeof value === 'string' ? value.trim().slice(0, 130) : '';
const normalizePeople = people => [...new Map((Array.isArray(people) ? people : [])
  .filter(person => uuid(person?.id) && title(person.nickname))
  .map(person => [person.id, { id: person.id, nickname: title(person.nickname), avatar: validFaceitAvatar(person.avatar),
    country: typeof person.country === 'string' && /^[a-z]{2}$/i.test(person.country) ? person.country.toUpperCase() : null }])).values()];

export function parseCoachLobby(payload, match, checkedAt = new Date().toISOString()) {
  if (payload?.id !== match.id || payload.game !== 'cs2' || payload.entity?.type !== 'championship'
    || !/^\s*(?:ESEA\s|S\d+\s+(?:EU|NA|SA|AF|AS|OCE)\s)/i.test(payload.entity.name || '')) return null;
  if (!payload.teams?.faction1 || !payload.teams?.faction2) return null;
  const sides = [payload.teams.faction1, payload.teams.faction2];
  const ids = new Set([match.team1_id, match.team2_id]);
  if (ids.size !== 2 || !sides.every(side => uuid(side.id) && ids.has(side.id)) || sides[0].id === sides[1].id) return null;
  const teams = sides.filter(side => Array.isArray(side.coaches)).map(side => {
    const coaches = normalizePeople(side.coaches);
    const ids = new Set(coaches.map(coach => coach.id));
    return { id: side.id, name: title(side.name), logo: validFaceitAvatar(side.avatar), coaches,
      roster: normalizePeople(side.roster).filter(person => !ids.has(person.id)) };
  });
  return { match_id: match.id, team_ids: teams.map(team => team.id),
    coach_ids: [...new Set(teams.flatMap(team => team.coaches.map(coach => coach.id)))], teams,
    checked_at: checkedAt, retry_at: null, terminal: finished(payload.status) };
}

export async function fetchCoachLobby(match) {
  if (!matchId(match.id)) throw new Error('Invalid FACEIT room ID');
  const response = await fetch(`https://www.faceit.com/api/match/v2/match/${encodeURIComponent(match.id)}`, {
    headers: { accept: 'application/json' }, signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`FACEIT room HTTP ${response.status}`);
  const data = await response.json();
  const parsed = parseCoachLobby(data.payload, match);
  if (!parsed || finished(match.status) && !parsed.terminal) throw new Error('FACEIT room identity or status did not match');
  return parsed;
}
