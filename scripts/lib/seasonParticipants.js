import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import process from "node:process";
import { getInitialPoints } from "../../src/utils/teamRating.js";

export function validateSeasonReport(report, entities) {
  if (!Number.isInteger(report.season) || !report.seasonId) throw new Error("Missing season identity");
  if (!entities.length || report.imports.length !== entities.length) throw new Error("Incomplete season import");
  const imported = new Map(report.imports.map((item) => [item.entityId, item]));
  for (const entity of entities) {
    const item = imported.get(entity.entityId);
    if (!item || item.rows < 1) throw new Error(`Season switch deferred: empty ${entity.region} / ${entity.division}`);
    if (item.invalidRows) throw new Error(`Invalid team identities in ${entity.entityId}`);
  }
  const seen = new Set();
  for (const team of report.teams) {
    if (!team.team_id || seen.has(team.team_id)) throw new Error("Missing or duplicate FACEIT team ID");
    seen.add(team.team_id);
    const groups = new Set(team.sources.map((s) => `${s.region}|${s.division}`));
    if (groups.size !== 1) throw new Error(`Conflicting registrations for ${team.team_id}`);
  }
  if (!seen.size) throw new Error("Refusing to activate an empty season");
}

export async function syncSeasonParticipants(report, entities) {
  validateSeasonReport(report, entities);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Season participant sync requires server-side Supabase credentials");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: settings, error: settingsError } = await db
    .from("rating_season_settings").select("active_season").single();
  if (settingsError) throw settingsError;
  if (settings.active_season < report.season) {
    // Finish the old period before freezing its scores. That replay excludes
    // future-season games even if discovery has already inserted their rooms.
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["scripts/recalculateRatings.js", "--apply"], {
        stdio: "inherit", env: process.env,
      });
      child.on("error", reject);
      child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Pre-season rating replay failed: ${code}`)));
    });
  }
  const rows = report.teams.map((team) => {
    const source = team.sources[0];
    return {
      team_id: team.team_id, team_name: team.name,
      division: source.division, region: source.region,
      league_team_id: team.league_team_id,
      initial_points: getInitialPoints(source.division),
      slug: team.runtimeSlug,
      runtime: team.runtime,
    };
  });
  const { data, error } = await db.rpc("sync_season_participants", {
    p_season: report.season, p_season_id: report.seasonId,
    p_teams: rows, p_imports: report.imports,
    p_expected_groups: entities.map((e) => e.entityId),
  });
  if (error) throw new Error(`Season participants were not applied: ${error.message}`);
  console.log("Season participants:", JSON.stringify(data));
  return data;
}

// All earlier-season league results are already represented in the fixed seed.
// Non-league tournaments keep influencing ratings after the season transition.
export function belongsToRatingPeriod(match, season) {
  const namedSeason = String(match.competition_name || "").match(/(?:\bS|\bSeason\s+)(\d+)\b/i);
  if (!season?.rating_from) return !namedSeason || Number(namedSeason[1]) <= (season?.season ?? Infinity);
  if (namedSeason) return Number(namedSeason[1]) === season.season;
  const at = Date.parse(match.finished_at || match.scheduled_at);
  return Number.isFinite(at) && at >= Date.parse(season.rating_from);
}
