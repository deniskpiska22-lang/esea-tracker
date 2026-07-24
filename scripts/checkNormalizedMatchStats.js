import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Supabase environment variables are required");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const matchId = process.argv[2];
if (!matchId) throw new Error("Usage: node --env-file=.env.local scripts/checkNormalizedMatchStats.js <matchId>");

const [{ data: maps, error: mapsError }, { data: players, error: playersError }] = await Promise.all([
  supabase.from("match_maps").select("*").eq("match_id", matchId).order("map_index"),
  supabase.from("match_player_stats").select("*").eq("match_id", matchId).order("team_name").order("kills", { ascending: false }),
]);

if (mapsError) throw mapsError;
if (playersError) throw playersError;
console.log(JSON.stringify({ matchId, maps, players }, null, 2));
