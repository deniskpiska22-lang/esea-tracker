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
    const urls = [], aliases = [];
    for (let offset = 0; ; offset += 1000) {
      const [urlResult, aliasResult] = await Promise.all([
        supabase.from("team_profile_urls").select("team_id,slug").order("team_id").range(offset, offset + 999),
        supabase.from("team_profile_aliases").select("team_id,slug").order("slug").range(offset, offset + 999),
      ]);
      if (urlResult.error || aliasResult.error) throw urlResult.error || aliasResult.error;
      urls.push(...urlResult.data); aliases.push(...aliasResult.data);
      if (urlResult.data.length < 1000 && aliasResult.data.length < 1000) break;
    }
    const byUrlId = new Map(urls.map(row => [row.team_id, row.slug]));
    const byAliasId = new Map();
    for (const row of aliases) {
      if (!byAliasId.has(row.team_id)) byAliasId.set(row.team_id, []);
      byAliasId.get(row.team_id).push(row.slug);
    }
    cachedTeams = [...byId.values()].map(team => ({...team,
      profileSlug: byUrlId.get(team.faceitTeamId), urlAliases: byAliasId.get(team.faceitTeamId) || []}));
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
