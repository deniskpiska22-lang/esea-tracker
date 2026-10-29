export function validFaceitAvatar(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (url.hostname === 'faceit-cdn.net' || url.hostname.endsWith('.faceit-cdn.net')) ? url.href : null;
  } catch { return null; }
}
export function withCurrentTeamAvatar(team, avatar) {
  const current = validFaceitAvatar(avatar);
  return current ? { ...team, logo: current, faceitAvatar: current } : team;
}
