import { useEffect, useState } from "react";
import { isAdProviderEnabled, loadAdPolicy } from "../lib/adPolicy.js";

export default function AdGeoGate({ children, provider = "onewin" }) {
  const [policy, setPolicy] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadAdPolicy().then(result => { if (!cancelled) setPolicy(result); });
    return () => { cancelled = true; };
  }, []);
  // Block mounting images, affiliate links and impression tracking until allowed.
  return isAdProviderEnabled(policy, provider) ? children : null;
}
