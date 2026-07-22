import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const LIMIT = Number(process.env.STATS_IMPORT_LIMIT || 500);
const MIN_DELAY_MS = Number(process.env.STATS_MIN_DELAY_MS || 4000);
const MAX_DELAY_MS = Number(process.env.STATS_MAX_DELAY_MS || 8000);
const CDP_URL = process.env.PLAYWRIGHT_CDP_URL || "http://127.0.0.1:9222";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are required");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function numberValue(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") {
      const result = Number(value);
      if (!Number.isNaN(result)) return result;
    }
  }
  return fallback;
}

function normalizePlayer(player = {}) {
  const stats = player.player_stats || player.playerStats || player.stats || player;
  const kills = numberValue(stats, ["Kills", "kills"]);
  const deaths = numberValue(stats, ["Deaths", "deaths"]);
  const headshots = numberValue(stats, ["Headshots", "headshots"]);
  const rawKd = numberValue(stats, ["K/D Ratio", "K/D", "kd"], null);
  const rawHsRate = numberValue(stats, ["Headshots %", "Headshots%", "HS%", "hsRate", "headshots_percentage"], null);
  return {
    playerId: player.player_id || player.playerId || player.id || null,
    nickname: player.nickname || player.player_name || player.playerName || stats.Nickname || "Unknown",
    kills,
    deaths,
    assists: numberValue(stats, ["Assists", "assists"]),
    adr: numberValue(stats, ["ADR", "adr", "Average Damage per Round"]),
    kd: rawKd ?? (deaths > 0 ? kills / deaths : kills),
    hsRate: rawHsRate ?? (kills > 0 ? (headshots / kills) * 100 : 0),
    kast: numberValue(stats, ["KAST %", "KAST", "kast"]),
    mvps: numberValue(stats, ["MVPs", "MVP", "mvps"]),
  };
}

function normalizeTeam(team = {}) {
  const stats = team.team_stats || team.teamStats || team.stats || team;
  return {
    teamId: team.team_id || team.teamId || stats.TeamId || stats.team_id || null,
    teamName: team.team_name || team.teamName || stats.Team || stats.team_name || "Unknown",
    score: numberValue(stats, ["Final Score", "Score", "score", "final_score"]),
    players: (Array.isArray(team.players) ? team.players : []).map(normalizePlayer),
  };
}

function compactStats(body) {
  const match = Array.isArray(body) ? body[0] : body;
  if (!match || typeof match !== "object") return null;
  const teams = (Array.isArray(match.teams) ? match.teams : []).map(normalizeTeam);
  if (teams.length < 2 || teams.some((team) => team.players.length === 0)) return null;
  return {
    matchId: match.match_id || match.matchId || null,
    map: match.map || null,
    teams,
  };
}

async function loadCandidates() {
  const { data, error } = await supabase
    .from("matches")
    .select("id,map_scores,player_stats,stats_synced")
    .in("status", ["FINISHED", "MATCH_STATUS_FINISHED"])
    .or("stats_synced.eq.false,stats_synced.is.null,player_stats.is.null")
    .order("finished_at", { ascending: true, nullsFirst: false })
    .limit(LIMIT);
  if (error) throw error;
  return data || [];
}

const randomDelay = () => MIN_DELAY_MS + Math.random() * Math.max(0, MAX_DELAY_MS - MIN_DELAY_MS);

async function main() {
  const candidates = await loadCandidates();
  console.log(`Candidates: ${candidates.length}`);
  if (!candidates.length) return;

  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages().find((item) => item.url().includes("faceit.com"));
  if (!page) throw new Error("Open FACEIT in Edge first, logged in, with remote debugging enabled");

  let synced = 0;
  let failed = 0;

  for (let index = 0; index < candidates.length; index += 1) {
    const match = candidates[index];
    try {
      const result = await page.evaluate(async (matchId) => {
        const response = await fetch(`https://www.faceit.com/api/stats/v3/matches/${matchId}`, {
          credentials: "include",
          headers: { accept: "application/json" },
        });
        let body = null;
        try { body = await response.json(); } catch {}
        return { status: response.status, body };
      }, match.id);

      if (result.status !== 200 || !result.body) {
        throw new Error(`FACEIT stats status ${result.status}`);
      }

      const playerStats = compactStats(result.body);
      if (!playerStats) throw new Error("Player statistics are empty or incomplete");
      playerStats.matchId = match.id;

      const hasMaps = Array.isArray(match.map_scores) && match.map_scores.length > 0;
      const now = new Date().toISOString();
      const { error } = await supabase.from("matches").update({
        player_stats: playerStats,
        stats_synced: hasMaps,
        stats_synced_at: hasMaps ? now : null,
        updated_at: now,
      }).eq("id", match.id);
      if (error) throw error;

      synced += 1;
      console.log(`SAVED ${match.id} (${index + 1}/${candidates.length}); total=${synced}`);
      await page.waitForTimeout(randomDelay());
    } catch (error) {
      failed += 1;
      console.error(`FAILED ${match.id}: ${error.message}`);
      await page.waitForTimeout(Math.max(10000, randomDelay()));
    }
  }

  console.log(JSON.stringify({ ok: true, candidates: candidates.length, synced, failed }, null, 2));
  await browser.close().catch(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
