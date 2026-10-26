// Team overviews use the native card instead of side rails and mobile banners.
export function isTeamOverviewRoute(pathname = '') {
  return /^\/(?:en\/|ru\/|de\/|pt\/|es\/|fr\/|it\/)?teams\/[^/]+\/?$/.test(pathname);
}
