import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  throw new Error("Supabase environment variables are required");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function migratePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload.teams) && payload.teams.length > 0) return null;

  const players = Array.isArray(payload.players) ? payload.players : [];
  if (players.length === 0) return null;

  const teamsByKey = new Map();

  for (const player of players) {
    const key = String(
      player.teamId || player.team_id || player.teamName || player.team_name || "unknown-team"
    );

    if (!teamsByKey.has(key)) {
      teamsByKey.set(key, {
        teamId: player.teamId || player.team_id || null,
        teamName: player.teamName || player.team_name || "Unknown",
        score: 0,
        players: [],
      });
    }

    teamsByKey.get(key).players.push(player);
  }

  for (const map of Array.isArray(payload.maps) ? payload.maps : []) {
    for (const team of Array.isArray(map?.teams) ? map.teams : []) {
      const key = String(
        team.teamId || team.team_id || team.teamName || team.team_name || "unknown-team"
      );
      const target = teamsByKey.get(key);
      if (target) target.score += toNumber(team.score);
    }
  }

  const teams = [...teamsByKey.values()];
  if (teams.length < 2) return null;

  return { ...payload, teams };
}

async function main() {
  const pageSize = 500;
  let from = 0;
  let checked = 0;
  let migrated = 0;

  while (true) {
    const { data, error } = await supabase
      .from("matches")
      .select("id,player_stats")
      .not("player_stats", "is", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const rows = data || [];

    for (const row of rows) {
      checked += 1;
      const migratedPayload = migratePayload(row.player_stats);
      if (!migratedPayload) continue;

      const { error: updateError } = await supabase
        .from("matches")
        .update({
          player_stats: migratedPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) throw updateError;
      migrated += 1;
      console.log(`MIGRATED ${row.id}`);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  console.log(JSON.stringify({ checked, migrated }, null, 2));
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exitCode = 1;
});
