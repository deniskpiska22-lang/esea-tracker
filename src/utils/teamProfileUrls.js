export function findTeamByRoute(teams, key) {
  return teams.find(team => team.faceitTeamId === key)
    || teams.find(team => team.profileSlug === key)
    || teams.find(team => team.slug === key || team.urlAliases?.includes(key))
    || null;
}
export function teamPublicPath(to, teams) {
  if (typeof to !== 'string') {
    return to?.pathname ? { ...to, pathname: teamPublicPath(to.pathname, teams) } : to;
  }
  return to.replace(/^(\/(?:ru|en|de|pt|es|fr|it))?\/(?:teams|team)\/([^/?#]+)/,
    (full, locale = '', key) => {
      let decoded; try { decoded = decodeURIComponent(key); } catch { return full; }
      const team = findTeamByRoute(teams, decoded);
      return team?.profileSlug ? `${locale}/teams/${encodeURIComponent(team.profileSlug)}` : full;
    });
}
