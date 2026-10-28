import { useEffect, useState } from "react";
import { isAdProviderEnabled, subscribeAdPolicy } from "../lib/adPolicy.js";

export default function AdGeoGate({ children, provider = "onewin" }) {
  const [policy, setPolicy] = useState(null);
  useEffect(() => subscribeAdPolicy(setPolicy), []);
  // Block mounting images, affiliate links and impression tracking until allowed.
  return isAdProviderEnabled(policy, provider) ? children : null;
}
