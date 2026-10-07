import { useEffect, useState } from "react";

// Share one request across all placements. Never persist an allow decision across visits.
let policyRequest;
function loadAdPolicy() {
  if (!policyRequest) {
    policyRequest = fetch("/api/ad-policy", {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(5000),
    })
      .then(response => response.ok ? response.json() : null)
      .then(policy => policy?.adsEnabled === true)
      .catch(() => false);
  }
  return policyRequest;
}

export default function AdGeoGate({ children }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadAdPolicy().then(enabled => { if (!cancelled) setAllowed(enabled); });
    return () => { cancelled = true; };
  }, []);
  // Block mounting images, affiliate links and impression tracking until allowed.
  return allowed ? children : null;
}
