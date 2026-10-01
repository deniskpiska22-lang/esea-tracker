import { useEffect, useState } from "react";
import staticTeams from "../data/teams.js";
import { supabase } from "../lib/supabaseClient.js";

// Railway can register teams without requiring a frontend rebuild.
export function useTeamCatalog() {
  const [teams, setTeams] = useState(staticTeams);
  const [catalogLoading, setCatalogLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!supabase) return;
        const byId = new Map(staticTeams.map((team) => [team.faceitTeamId, team]));
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.from("team_catalog").select("team_id,team")
            .order("team_id").range(offset, offset + 999);
          if (error) throw error;
          for (const row of data || []) byId.set(row.team_id, { ...byId.get(row.team_id), ...row.team });
          if (data.length < 1000) break;
        }
        if (!cancelled) setTeams([...byId.values()]);
      } catch (error) {
        console.warn("Team catalog unavailable; keeping bundled pages:", error.message);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);
  return { teams, catalogLoading };
}
