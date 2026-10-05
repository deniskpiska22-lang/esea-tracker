import { useEffect, useState } from "react";
import staticTeams from "../data/teams.js";
import { supabase } from "../lib/supabaseClient.js";

let cachedTeams = staticTeams;
let cachedAt = 0;
let pending = null;
async function loadCatalog() {
  if (!supabase || Date.now() - cachedAt < 60000) return cachedTeams;
  if (pending) return pending;
  pending = (async () => {
    const byId = new Map(staticTeams.map((team) => [team.faceitTeamId, team]));
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("team_catalog").select("team_id,team")
        .order("team_id").range(offset, offset + 999);
      if (error) throw error;
      for (const row of data || []) byId.set(row.team_id, { ...byId.get(row.team_id), ...row.team });
      if ((data || []).length < 1000) break;
    }
    cachedTeams = [...byId.values()];
    cachedAt = Date.now();
    return cachedTeams;
  })().finally(() => { pending = null; });
  return pending;
}

export function useTeamCatalog() {
  const [teams, setTeams] = useState(cachedTeams);
  const [catalogLoading, setCatalogLoading] = useState(!cachedAt);
  useEffect(() => {
    let cancelled = false;
    loadCatalog().then((rows) => { if (!cancelled) setTeams(rows); })
      .catch((error) => console.warn("Team catalog unavailable:", error.message))
      .finally(() => { if (!cancelled) setCatalogLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { teams, catalogLoading };
}
