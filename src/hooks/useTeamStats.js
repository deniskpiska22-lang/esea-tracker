import { useEffect, useState } from "react";

export function useTeamStats(slug, fallbackMatches = []) {
  const [matches, setMatches] = useState(fallbackMatches);
  const [maps, setMaps] = useState(null);

  useEffect(() => {
    if (!slug) return undefined;
    const controller = new AbortController();
    fetch(`/api/team-stats?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!payload?.ok) throw new Error(payload?.error || "Failed to load team stats");
        setMatches(Array.isArray(payload.matches) ? payload.matches : []);
        setMaps(Array.isArray(payload.maps) ? payload.maps : []);
      })
      .catch((error) => {
        if (error.name !== "AbortError") console.warn("Team stats fallback is used:", error.message);
      });
    return () => controller.abort();
  }, [slug]);

  return { matches, maps };
}
