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

async function upsertPlayers(members) {
  const uniqueRows = Array.from(
    new Map(
      members
        .map(normalizeMember)
        .filter(Boolean)
        .map((player) => [player.faceit_id, player]),
    ).values(),
  );

  if (!uniqueRows.length) {
    return [];
  }

  const { data: known, error: readError } = await supabase.from("players").select("*").in("faceit_id", uniqueRows.map(p => p.faceit_id));
  if (readError) throw readError;
  const knownById = new Map((known || []).map(p => [p.faceit_id, p]));
  for (const row of uniqueRows) {
    const previous = knownById.get(row.faceit_id);
    for (const field of ["avatar", "country", "steam_id", "faceit_elo", "faceit_level"]) {
      if (row[field] == null && previous?.[field] != null) row[field] = previous[field];
    }
  }
  const { data, error } = await supabase
    .from("players")
    .upsert(uniqueRows, { onConflict: "faceit_id" })
    .select("id,faceit_id,nickname");

  if (error) {
    throw new Error(`players upsert failed: ${error.message}`);
  }

  return data || [];
}

async function syncOneTeam(faceitTeam) {
  const teamId = cleanString(faceitTeam?.id);

  if (!teamId) {
    return { skipped: true, reason: "missing_team_id" };
  }

  const members = Array.isArray(faceitTeam?.members)
    ? faceitTeam.members
    : [];

  if (!members.length) return { skipped: true, reason: "empty_roster" };
  const databasePlayers = await upsertPlayers(members);
  const activePlayerIds = databasePlayers.map((player) => player.id);
  const now = new Date().toISOString();

  const { data: existingLinks, error: linksReadError } = await supabase
    .from("team_players")
    .select("id,player_id,joined_at,is_active")
    .eq("team_id", teamId);

  if (linksReadError) {
    throw new Error(
      `team_players read failed for ${teamId}: ${linksReadError.message}`,
    );
  }

  const existingByPlayerId = new Map(
    (existingLinks || []).map((link) => [link.player_id, link]),
  );

  if (databasePlayers.length) {
    const relationRows = databasePlayers.map((player) => {
      const existing = existingByPlayerId.get(player.id);

      return {
        team_id: teamId,
        player_id: player.id,
        joined_at: existing?.joined_at || now,
        left_at: null,
        is_active: true,
      };
    });

    const { error: relationError } = await supabase
      .from("team_players")
      .upsert(relationRows, { onConflict: "team_id,player_id" });

    if (relationError) {
      throw new Error(
        `team_players upsert failed for ${teamId}: ${relationError.message}`,
      );
    }
  }

  const staleLinkIds = (existingLinks || [])
    .filter(
      (link) =>
        link.is_active === true && !activePlayerIds.includes(link.player_id),
    )
    .map((link) => link.id);

  if (staleLinkIds.length) {
    const { error: deactivateError } = await supabase
      .from("team_players")
      .update({
        is_active: false,
        left_at: now,
      })
      .in("id", staleLinkIds);

    if (deactivateError) {
      throw new Error(
        `Could not deactivate old players for ${teamId}: ${deactivateError.message}`,
      );
    }
  }

  const { data: catalog, error: catalogReadError } = await supabase.from("team_catalog").select("team").eq("team_id", teamId).maybeSingle();
  if (catalogReadError) throw catalogReadError;
  if (catalog) {
    const playerIds = databasePlayers.map(p => p.faceit_id);
    const players = databasePlayers.map(p => p.nickname);
    if (JSON.stringify(catalog.team.playerIds) !== JSON.stringify(playerIds) || JSON.stringify(catalog.team.players) !== JSON.stringify(players)) {
      const { error } = await supabase.from("team_catalog").update({team:{...catalog.team,playerIds,players},updated_at:now}).eq("team_id",teamId);
      if (error) throw error;
    }
  }
  return {
    skipped: false,
    members: databasePlayers.length,
    deactivated: staleLinkIds.length,
  };
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
  const jobs=rows.filter(r=>r.team.activeSeasonParticipant).map(r=>({id:r.team_id}));
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
