import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { runDiscoveryScan, retryAfterMs } from "./lib/discoveryScan.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

const REQUEST_DELAY_MS = Math.max(
  0,
  Number(process.env.ROSTER_SYNC_DELAY_MS || 500),
);

const REQUEST_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.ROSTER_REQUEST_TIMEOUT_MS || 30000),
);

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is required");
}

if (!SUPABASE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is required",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function cleanString(value) {
  const result = String(value ?? "").trim();
  return result || null;
}

function normalizeCountry(value) {
  const country = cleanString(value);
  return country ? country.toUpperCase() : null;
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function normalizeMember(raw) {
  const faceitId = cleanString(raw?.user_id ?? raw?.id ?? raw?.player_id ?? raw?.playerId);

  if (!faceitId) {
    return null;
  }

  const cs2 = raw?.games?.cs2 || {};

  return {
    faceit_id: faceitId,
    nickname: cleanString(raw?.nickname ?? raw?.name) || faceitId,
    avatar: cleanString(raw?.avatar),
    country: normalizeCountry(raw?.country),
    steam_id: cleanString(
      raw?.steam_id_64 ?? raw?.steam_id ?? raw?.steamId,
    ),
    faceit_elo: numberOrNull(
      cs2?.faceit_elo ?? cs2?.faceitElo ?? raw?.faceit_elo ?? raw?.elo,
    ),
    faceit_level:
      numberOrNull(
        cs2?.skill_level ??
          cs2?.skillLevel ??
          raw?.skill_level ??
          raw?.level,
      ),
    updated_at: new Date().toISOString(),
  };
}

async function fetchTeam(id) {
  const response = await fetch(`https://open.faceit.com/data/v4/teams/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${process.env.FACEIT_API_KEY}`, accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}`);
    error.status = response.status;
    error.retryAfterMs = retryAfterMs(response.headers.get("retry-after"));
    throw error;
  }
  const team = await response.json();
  if (!Array.isArray(team.members) || !team.members.length) return null;
  return { id: team.team_id || id, members: team.members };
}

async function syncOneTeam(team) {
  const members=[...new Map((team.members || []).map(normalizeMember).filter(Boolean).map(p=>[p.faceit_id,p])).values()];
  if (!members.length) return;
  const {data,error}=await supabase.rpc("sync_registered_team_roster",{p_team_id:team.id,p_members:members});
  if(error) throw new Error(`Roster ${team.id}: ${error.message}`);
  if(data?.skipped) console.warn(`Roster ${team.id} skipped: ${data.reason || "incomplete"}`);
}

async function main() {
  if (!process.env.FACEIT_API_KEY) throw new Error("FACEIT_API_KEY is required");
  const rows = [];
  for (let offset=0;;offset+=1000) {
    const {data,error}=await supabase.from("team_catalog").select("team_id,team").order("team_id").range(offset,offset+999);
    if(error) throw error;
    rows.push(...(data || []));
    if((data || []).length<1000) break;
  }
  const active=rows.filter(r=>r.team.activeSeasonParticipant);
  const missing=active.filter(r=>!r.team.playerIds?.length);
  const jobs=(missing.length?missing:active).map(r=>({id:r.team_id}));
  const worker_name="roster-discovery";
  const {data:previous,error}=await supabase.from("worker_status").select("detail").eq("worker_name",worker_name).maybeSingle();
  if(error) throw error;
  let state={};
  try {state=JSON.parse(previous?.detail || "{}");} catch { /* older human-readable status */ }
  const summary=await runDiscoveryScan({jobs,state,intervalMs:Math.max(500,REQUEST_DELAY_MS),budgetMs:180000,maxRequests:160,
    fetchPage:async job=>{const team=await fetchTeam(job.id);return {rows:team?[team]:[],done:true};},
    saveRows:async teams=>{for(const team of teams) await syncOneTeam(team);},
    checkpoint:async progress=>{const now=new Date().toISOString();const {error}=await supabase.from("worker_status").upsert({worker_name,last_ping:now,updated_at:now,status:progress.retryAt?"cooldown":"online",detail:JSON.stringify(progress)},{onConflict:"worker_name"});if(error) throw error;},
    onError:(job,error)=>console.warn(`Roster discovery ${job.id}: ${error.message}`),
  });
  console.log("Roster discovery",JSON.stringify(summary));
}
main().catch(error=>{console.error("Roster sync failed:",error);process.exitCode=1;});
