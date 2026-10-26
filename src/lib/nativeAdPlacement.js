// Native placements replace banner rails on team overviews and match rooms.
export function usesNativeAdPlacement(pathname = '') {
  const path = pathname.replace(/^\/(?:en|ru|de|pt|es|fr|it)(?=\/)/, '');
  return /^\/(?:teams|team)\/[^/]+\/?$/.test(path)
    || /^\/(?:match|matches)\/[^/]+\/?$/.test(path)
    || /^\/(?:teams|team)\/[^/]+\/matches\/[^/]+\/?$/.test(path);
}
