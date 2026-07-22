import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const FILE = process.env.MATCH_STATS_JSON || "./src/data/matchStatsV3.json";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const BATCH_DELAY_MS = Number(process.env.JSON_IMPORT_DELAY_MS || 40);

if (!supabaseUrl || !supabaseKey) throw new Error("Supabase environment variables are missing");
if (!fs.existsSync(FILE)) throw new Error(`File not found: ${FILE}`);

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const source = JSON.parse(fs.readFileSync(FILE, "utf8"));
const entries = Object.entries(source);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function compact(matchId, matchData) {
  const match = Array.isArray(matchData) ? matchData[0] : matchData;
  if (!match) return null;
  const teams = (match.teams || []).map((team) => ({
    teamId: team.teamId || team.team_id || null,
    teamName: team.teamName || team.team_name || "Unknown",
    score: Number(team.score ?? team.team_stats?.["Final Score"] ?? 0),
    players: (team.players || []).map((player) => {
      const stats = player.player_stats || player.stats || player;
      const kills = Number(stats.Kills ?? stats.kills ?? 0);
      const deaths = Number(stats.Deaths ?? stats.deaths ?? 0);
      return {
        playerId: player.playerId || player.player_id || null,
        nickname: player.nickname || player.player_name || "Unknown",
        kills,
        deaths,
        assists: Number(stats.Assists ?? stats.assists ?? 0),
        adr: Number(stats.ADR ?? stats.adr ?? 0),
        kd: Number(stats["K/D Ratio"] ?? stats.kd ?? (deaths ? kills / deaths : kills)),
        hsRate: Number(stats["Headshots %"] ?? stats.hsRate ?? 0),
        kast: Number(stats["KAST %"] ?? stats.kast ?? 0),
        mvps: Number(stats.MVPs ?? stats.mvps ?? 0),
      };
    }),
  }));
  return { matchId, map: match.map || null, teams };
}

let saved = 0;
let failed = 0;
for (let index = 0; index < entries.length; index += 1) {
  const [matchId, raw] = entries[index];
  try {
    const playerStats = compact(matchId, raw);
    if (!playerStats || playerStats.teams.length < 2) throw new Error("empty stats");
    const { data: row, error: readError } = await supabase.from("matches").select("map_scores").eq("id", matchId).maybeSingle();
    if (readError) throw readError;
    if (!row) throw new Error("match not found in Supabase");
    const hasMaps = Array.isArray(row.map_scores) && row.map_scores.length > 0;
    const now = new Date().toISOString();
    const { error } = await supabase.from("matches").update({
      player_stats: playerStats,
      stats_synced: hasMaps,
      stats_synced_at: hasMaps ? now : null,
      updated_at: now,
    }).eq("id", matchId);
    if (error) throw error;
    saved += 1;
    console.log(`IMPORTED ${matchId} (${index + 1}/${entries.length})`);
  } catch (error) {
    failed += 1;
    console.error(`FAILED ${matchId}: ${error.message}`);
  }
  await sleep(BATCH_DELAY_MS);
}
console.log(JSON.stringify({ ok: true, total: entries.length, saved, failed }, null, 2));
