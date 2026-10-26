// Deliberately opt-in and scoped to the team overview. Never persist this flag.
export function isTeamAdPreview({ pathname = '', search = '' } = {}) {
  return /^\/(?:en\/|ru\/|de\/|pt\/|es\/|fr\/|it\/)?teams\/[^/]+\/?$/.test(pathname)
    && new URLSearchParams(search).get('adPreview') === 'native';
}
