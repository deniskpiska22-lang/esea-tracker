const indexes = new WeakMap();
export function findTeamByRoute(teams, key) {
  let index = indexes.get(teams);
  if (!index) {
    index = { ids: new Map(), profiles: new Map(), aliases: new Map() };
    const add = (map, value, team) => { if (value && !map.has(value)) map.set(value, team); };
    for (const team of teams) {
      add(index.ids, team.faceitTeamId, team);
      add(index.profiles, team.profileSlug, team);
      add(index.aliases, team.slug, team);
      for (const alias of team.urlAliases || []) add(index.aliases, alias, team);
    }
    indexes.set(teams, index);
  }
  return index.ids.get(key) || index.profiles.get(key) || index.aliases.get(key) || null;
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
