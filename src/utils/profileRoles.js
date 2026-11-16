export function playerRolePath(nickname, role = 'player', tab = '') {
  const query = new URLSearchParams();
  if (role === 'coach') query.set('role', 'coach');
  if (tab === 'teams') query.set('tab', 'teams');
  return `/players/${encodeURIComponent(nickname)}${query.size ? `?${query}` : ''}`;
}
