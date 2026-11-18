import { playerRolePath } from './profileRoles.js';

export function coachPath(coach, tab = '') {
  if (coach?.playerNickname) return playerRolePath(coach.playerNickname, 'coach', tab);
  const key = coach?.nickname || coach?.id;
  return `/coach/${encodeURIComponent(key || '')}${tab === 'teams' ? '?tab=teams' : ''}`;
}

export function coachLookupKey(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '') ? 'id' : 'player';
}
