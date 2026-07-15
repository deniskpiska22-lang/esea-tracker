import { createClient } from "@supabase/supabase-js";
import teams from "../src/data/teams.js";
import { CHAMPIONSHIPS } from "./matchSyncConfig.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const faceitApiKey = process.env.FACEIT_API_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const championshipName = new Map(CHAMPIONSHIPS.map((item) => [item.id, item.name]));
const DISCOVERY_STATUSES = ["MATCH_STATUS_SCHEDULED"];
const FINISHED_STATUSES = new Set(["FINISHED", "MATCH_STATUS_FINISHED", "CANCELLED", "MATCH_STATUS_CANCELLED"]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const asIso = (value) => {
  if (!value) return null;
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const normalizeName = (value = "") => value.replace(/\s+/g, "").toLowerCase();

function localTeam(id, name) {
  return teams.find((team) => team.faceitTeamId === id) ||
    teams.find((team) => name && normalizeName(team.name) === normalizeName(name)) || null;
}

function normalizeFaction(faction = {}) {
  const id = faction.premade_team_id || faction.faction_id || faction.team_id || faction.id || null;
  const name = faction.name || faction.nickname || "TBD";
  const local = localTeam(id, name);
  return {
    id,
    name: local?.name || name,
    slug: local?.slug || null,
    logo: local?.logo || faction.avatar || faction.logo || null,
  };
}

function scoreFromInternal(match, faction, index) {
  return faction?.match_score ?? match?.results?.score?.[faction?.premade_team_id] ??
    match?.results?.score?.[faction?.id] ?? match?.[`team${index + 1}_score`] ?? 0;
}

function internalToRow(match) {
  const factions = Array.isArray(match.factions) ? match.factions : [match.team1, match.team2].filter(Boolean);
  if (!match?.id || factions.length < 2) return null;
  const first = normalizeFaction(factions[0]);
  const second = normalizeFaction(factions[1]);
  const firstScore = Number(scoreFromInternal(match, factions[0], 0) || 0);
  const secondScore = Number(scoreFromInternal(match, factions[1], 1) || 0);
  const status = match.status || "MATCH_STATUS_SCHEDULED";
  const finished = FINISHED_STATUSES.has(status.toUpperCase());
  return {
    id: match.id,
    championship_id: match.championship_id || null,
    competition_name: championshipName.get(match.championship_id) || match.championship_name || "ESEA League",
    status,
    best_of: match.best_of ?? null,
    scheduled_at: asIso(match.scheduled_time || match.scheduled_at),
    started_at: asIso(match.started_time || match.started_at),
    finished_at: asIso(match.finished_time || match.finished_at),
    team1_id: first.id,
    team1_name: first.name,
    team1_slug: first.slug,
    team1_logo: first.logo,
    team1_score: firstScore,
    team2_id: second.id,
    team2_name: second.name,
    team2_slug: second.slug,
    team2_logo: second.logo,
    team2_score: secondScore,
    winner_id: finished ? (firstScore > secondScore ? first.id : secondScore > firstScore ? second.id : null) : null,
    faceit_url: `https://www.faceit.com/en/cs2/room/${match.id}`,
    raw_data: match,
    updated_at: new Date().toISOString(),
  };
}

function publicApiToPatch(data) {
  const entries = Object.entries(data?.teams || {});
  if (entries.length < 2) return null;
  const [firstKey, firstRaw] = entries[0];
  const [secondKey, secondRaw] = entries[1];
  const first = normalizeFaction(firstRaw);
  const second = normalizeFaction(secondRaw);
  const firstScore = Number(data.results?.score?.[firstKey] ?? firstRaw?.score ?? 0);
  const secondScore = Number(data.results?.score?.[secondKey] ?? secondRaw?.score ?? 0);
  const status = data.status || "UNKNOWN";
  const finished = FINISHED_STATUSES.has(status.toUpperCase());
  return {
    status,
    best_of: data.best_of ?? null,
    competition_name: data.competition_name || data.competition?.name || undefined,
    scheduled_at: asIso(data.scheduled_at),
    started_at: asIso(data.started_at),
    finished_at: asIso(data.finished_at) || (finished ? new Date().toISOString() : undefined),
    team1_id: first.id, team1_name: first.name, team1_slug: first.slug, team1_logo: first.logo,
    team1_score: firstScore,
    team2_id: second.id, team2_name: second.name, team2_slug: second.slug, team2_logo: second.logo,
    team2_score: secondScore,
    winner_id: data.results?.winner || (finished ? (firstScore > secondScore ? first.id : secondScore > firstScore ? second.id : null) : null),
    raw_data: data,
    updated_at: new Date().toISOString(),
  };
}

function buildDiscoveryUrl(teamId, status, limit = 20) {
  const params = new URLSearchParams();
  for (const item of CHAMPIONSHIPS) params.append("championship_ids", item.id);
  params.set("entityId", teamId);
  params.set("entityType", "PREMADE_TEAM");
  params.set("status", status);
  params.set("offset", "0");
  params.set("limit", String(limit));
  return `https://www.faceit.com/api/team-leagues/v2/matches?${params}`;
}

async function fetchJson(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
      const responseText = (await response.text()).slice(0, 500);
      const details = responseText ? `: ${responseText}` : "";
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`${response.status} ${response.statusText}${details}`);
      }
      lastError = new Error(`${response.status} ${response.statusText}${details}`);
    } catch (error) { lastError = error; }
    await sleep(400 * attempt);
  }
  throw lastError;
}

async function discoverMatches() {
  const rows = new Map();
  const trackedTeams = teams.filter((team) => team.faceitTeamId);
  const jobs = [];
  for (const team of trackedTeams) {
    // FACEIT's internal team-leagues endpoint currently accepts SCHEDULED and
    // FINISHED here. READY/ONGOING return HTTP 400, so live transitions are
    // handled below through the supported Data API match endpoint.
    for (const status of DISCOVERY_STATUSES) jobs.push({ team, status, limit: 40 });
    jobs.push({ team, status: "MATCH_STATUS_FINISHED", limit: 10 });
  }

  const concurrency = Number(process.env.MATCH_SYNC_CONCURRENCY || 5);
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      try {
        const data = await fetchJson(buildDiscoveryUrl(job.team.faceitTeamId, job.status, job.limit), {
          headers: { accept: "application/json", "user-agent": "Mozilla/5.0 ESEA-Tracker/1.0" },
        });
        for (const match of Array.isArray(data.payload) ? data.payload : []) {
          const row = internalToRow(match);
          if (row) rows.set(row.id, row);
        }
      } catch (error) {
        console.warn(`Discovery failed for ${job.team.name} (${job.status}): ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return [...rows.values()];
}

async function upsertDiscovered(rows) {
  if (!rows.length) return;
  for (let index = 0; index < rows.length; index += 200) {
    const { error } = await supabase.from("matches").upsert(rows.slice(index, index + 200), { onConflict: "id" });
    if (error) throw error;
  }
}

async function refreshActive() {
  if (!faceitApiKey) {
    console.warn("FACEIT_API_KEY is missing: discovery works, but live score refresh can be less accurate");
    return 0;
  }
  const { data, error } = await supabase.from("matches").select("id")
    .not("status", "in", '("FINISHED","MATCH_STATUS_FINISHED","CANCELLED","MATCH_STATUS_CANCELLED")')
    .order("scheduled_at", { ascending: true }).limit(250);
  if (error) throw error;
  let updated = 0;
  for (const match of data || []) {
    try {
      const payload = await fetchJson(`https://open.faceit.com/data/v4/matches/${encodeURIComponent(match.id)}`, {
        headers: { Authorization: `Bearer ${faceitApiKey}`, Accept: "application/json" },
      });
      const patch = publicApiToPatch(payload);
      if (!patch) continue;
      const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      const { error: updateError } = await supabase.from("matches").update(clean).eq("id", match.id);
      if (updateError) throw updateError;
      updated += 1;
    } catch (error) {
      console.warn(`Refresh failed ${match.id}: ${error.message}`);
    }
    await sleep(80);
  }
  return updated;
}

async function main() {
  const started = Date.now();
  const discovered = await discoverMatches();
  await upsertDiscovered(discovered);
  const refreshed = await refreshActive();
  console.log(JSON.stringify({ ok: true, discovered: discovered.length, refreshed, durationMs: Date.now() - started }));
}

main().catch((error) => {
  console.error("Automatic match sync failed:", error);
  process.exitCode = 1;
});
