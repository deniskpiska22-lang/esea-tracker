import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { buildTeamRanks } from "../utils/teamRanks.js";

let cachedRows = [];
let cachedAt = 0;
let pending = null;

async function loadRatings() {
  if (!supabase || Date.now() - cachedAt < 60000) return cachedRows;
  if (!pending) {
    pending = (async () => {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("current_team_ratings")
          .select("*").order("team_id").range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      cachedRows = rows;
      cachedAt = Date.now();
      return rows;
    })().finally(() => { pending = null; });
  }
  return pending;
}

export function useTeamRanks(enabled, teams) {
  const [rows, setRows] = useState(cachedRows);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadRatings().then(data => {
      if (!cancelled) setRows(data);
    }).catch(error => console.error("Failed to load team ranks:", error));
    return () => { cancelled = true; };
  }, [enabled]);
  return useMemo(() => buildTeamRanks(rows, teams), [rows, teams]);
}
