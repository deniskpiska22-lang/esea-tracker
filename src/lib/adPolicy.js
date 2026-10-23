// One request shared by banners and match odds, without persisting GEO across visits.
let policyRequest;

export function loadAdPolicy() {
  policyRequest ||= fetch('/api/ad-policy', {
    cache: 'no-store',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(5000),
  }).then(response => response.ok ? response.json() : null).catch(() => null);
  return policyRequest;
}

export function isAdProviderEnabled(policy, provider) {
  if (provider === 'pari') return policy?.pariEnabled === true;
  if (provider === 'onewin') return policy?.adsEnabled === true;
  return false;
}
