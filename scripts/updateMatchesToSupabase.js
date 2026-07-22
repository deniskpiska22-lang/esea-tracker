import { createClient } from "@supabase/supabase-js";
import teams from "../src/data/teams.generated.js";

const CHAMPIONSHIP_IDS = [
  "6c713b0c-dd31-4bd8-9571-484f84a5272d",
  "f404458c-3ff0-4b6a-abdf-89a6b13694ca",
  "54f32bd1-55d3-4353-8818-79f57ef7a65b",
  "8961a4f3-2860-4545-87db-1ce1e32c7e13",
  "de368982-42fc-428e-9d2e-cfdbaa7d6363",
  "b453b0b9-f5e5-4f08-964d-d127691243d0",
  "df648492-2f7f-44ac-abbe-1d179a38d7c3",
  "c1641aae-0e63-4564-a571-927091687b5b",
  "4cc00188-c9af-472d-b2cc-d60091f9834e",
  "dde840d0-cb47-49c9-9ac4-a51a11991c42",
  "cb6bfac6-dc14-4995-a170-909392cec298",
  "f6d5875a-af46-45f3-9db2-343e3aa974ec",
  "c44e1453-8043-41fe-8b4e-d9f9ac132f40",
  "83fc05fb-0f31-42e3-82c3-96c6dc16660a",
  "93ab0270-1ee0-42bc-b3df-32ec40d74078",
  "3889301e-0a67-4fa2-bed7-4a6ffb6de3fa",
  "2a658dac-a1fa-4adb-bff0-f4fb9d9f2f74",
  "106062e2-b895-4485-9eba-0fc33964928e",
  "a96a8895-6f83-4d47-8877-c036d83be418",
  "6faf7269-8a1b-4403-ae45-d2a9fa8cbb8e",
  "88e1f562-e95b-4e80-b196-111aabbbf7cc",
  "af4ebc04-acf2-4785-b98d-47ec1e37706e",
  "717e14e8-5da6-4d21-ac8a-3df742e8c855",
  "7dfdafbe-2898-43e4-ba19-68d3a0e6c64e",
  "9523d8b6-4173-48be-9407-76d587b9d8d4",
  "62990daa-bd22-4e2c-be51-df8a117d8ab7",
  "966da0d9-7d3c-4238-b0da-82e37ba3c105",
  "045a2e2a-394d-4d2b-8ff3-4deab0227bd4",
  "6f84ee24-dc39-4c9a-b303-e765f1153f20",
  "51706dfb-c98b-4471-8aed-c406f1b99970",
  "b3d1f519-1524-45ca-a7d8-fd83f3419202",
  "56253486-2d88-4512-9649-6296f50a38b9",
  "86555399-fcc9-4094-9b67-8e8d9c2405b5",
];

const CHAMPIONSHIP_NAMES = {
  "6c713b0c-dd31-4bd8-9571-484f84a5272d": "EU ECL S52 Cup 1 - Playoffs",
  "f404458c-3ff0-4b6a-abdf-89a6b13694ca": "S58 EU Advanced Central - Regular Season",
  "54f32bd1-55d3-4353-8818-79f57ef7a65b": "S58 EU Main A - Regular Season",
  "8961a4f3-2860-4545-87db-1ce1e32c7e13": "S58 EU Main B - Regular Season",
  "de368982-42fc-428e-9d2e-cfdbaa7d6363": "S58 EU Intermediate A - Regular Season",
  "b453b0b9-f5e5-4f08-964d-d127691243d0": "S58 EU Intermediate B - Regular Season",
  "df648492-2f7f-44ac-abbe-1d179a38d7c3": "S58 EU Entry A - Regular Season",
  "c1641aae-0e63-4564-a571-927091687b5b": "S58 EU Entry B - Regular Season",
  "4cc00188-c9af-472d-b2cc-d60091f9834e": "S58 EU Entry C - Regular Season",
  "dde840d0-cb47-49c9-9ac4-a51a11991c42": "S58 EU Entry D - Regular Season",
  "cb6bfac6-dc14-4995-a170-909392cec298": "ESEA Finals S57",
  "c44e1453-8043-41fe-8b4e-d9f9ac132f40": "S57 EU Advanced Central - Regular Season",
  "f6d5875a-af46-45f3-9db2-343e3aa974ec": "S57 EU Advanced Central - Playoffs",
  "83fc05fb-0f31-42e3-82c3-96c6dc16660a": "S57 EU Main A - Regular Season",
  "93ab0270-1ee0-42bc-b3df-32ec40d74078": "S57 EU Main B - Regular Season",
  "3889301e-0a67-4fa2-bed7-4a6ffb6de3fa": "S57 EU Main A - Playoffs",
  "2a658dac-a1fa-4adb-bff0-f4fb9d9f2f74": "S57 EU Main B - Playoffs",
  "106062e2-b895-4485-9eba-0fc33964928e": "S57 EU Intermediate A - Regular Season",
  "a96a8895-6f83-4d47-8877-c036d83be418": "S57 EU Intermediate B - Regular Season",
  "6faf7269-8a1b-4403-ae45-d2a9fa8cbb8e": "S57 EU Intermediate C - Regular Season",
  "88e1f562-e95b-4e80-b196-111aabbbf7cc": "S57 EU Intermediate D - Regular Season",
  "af4ebc04-acf2-4785-b98d-47ec1e37706e": "S57 EU Intermediate A - Playoffs",
  "717e14e8-5da6-4d21-ac8a-3df742e8c855": "S57 EU Intermediate B - Playoffs",
  "7dfdafbe-2898-43e4-ba19-68d3a0e6c64e": "S57 EU Intermediate C - Playoffs",
  "9523d8b6-4173-48be-9407-76d587b9d8d4": "S57 EU Intermediate D - Playoffs",
  "62990daa-bd22-4e2c-be51-df8a117d8ab7": "S57 EU Entry A - Regular Season",
  "966da0d9-7d3c-4238-b0da-82e37ba3c105": "S57 EU Entry B - Regular Season",
  "045a2e2a-394d-4d2b-8ff3-4deab0227bd4": "S57 EU Entry C - Regular Season",
  "6f84ee24-dc39-4c9a-b303-e765f1153f20": "S57 EU Entry D - Regular Season",
  "51706dfb-c98b-4471-8aed-c406f1b99970": "S57 EU Entry A - Playoffs",
  "b3d1f519-1524-45ca-a7d8-fd83f3419202": "S57 EU Entry B - Playoffs",
  "56253486-2d88-4512-9649-6296f50a38b9": "S57 EU Entry C - Playoffs",
  "86555399-fcc9-4094-9b67-8e8d9c2405b5": "S57 EU Entry D - Playoffs",
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const PAGE_LIMIT = Number(process.env.MATCH_PAGE_LIMIT || 40);
const UPSERT_BATCH_SIZE = Number(process.env.MATCH_UPSERT_BATCH_SIZE || 200);
const TEAM_DELAY_MS = Number(process.env.MATCH_TEAM_DELAY_MS || 250);

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are required");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeName = (value = "") => String(value).replace(/\s+/g, "").toLowerCase();

function localTeam(id, name) {
  return teams.find((team) => team.faceitTeamId === id) ||
    teams.find((team) => normalizeName(team.name) === normalizeName(name)) || null;
}

function buildUrl(teamId, offset = 0) {
  const params = new URLSearchParams();
  CHAMPIONSHIP_IDS.forEach((id) => params.append("championship_ids", id));
  params.set("entityId", teamId);
  params.set("entityType", "PREMADE_TEAM");
  params.set("status", "MATCH_STATUS_FINISHED");
  params.set("offset", String(offset));
  params.set("limit", String(PAGE_LIMIT));
  return `https://www.faceit.com/api/team-leagues/v2/matches?${params}`;
}

function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeMatch(match) {
  const factions = Array.isArray(match.factions) ? match.factions : [];
  if (factions.length < 2) return null;

  const first = factions[0];
  const second = factions[1];
  const firstLocal = localTeam(first.premade_team_id, first.name);
  const secondLocal = localTeam(second.premade_team_id, second.name);

  const firstMaps = Array.isArray(first.map_scores) ? first.map_scores : [];
  const secondMaps = Array.isArray(second.map_scores) ? second.map_scores : [];
  const mapScores = firstMaps.map((map, index) => {
    const opponent = secondMaps[index] || {};
    const team1Score = Number(map.score ?? 0);
    const team2Score = Number(opponent.score ?? 0);
    return {
      map: map.map_name || opponent.map_name || "unknown",
      order: index + 1,
      team1_id: first.premade_team_id || null,
      team1_name: firstLocal?.name || first.name || "Unknown",
      team1_score: team1Score,
      team2_id: second.premade_team_id || null,
      team2_name: secondLocal?.name || second.name || "Unknown",
      team2_score: team2Score,
      winner_id: team1Score > team2Score ? first.premade_team_id : team2Score > team1Score ? second.premade_team_id : null,
    };
  });

  const technical = mapScores.length === 0 || mapScores.some((map) =>
    map.map === "unknown" ||
    (map.team1_score === 1 && map.team2_score === 0) ||
    (map.team1_score === 0 && map.team2_score === 1)
  );
  if (technical) return null;

  const team1Score = Number(first.match_score ?? 0);
  const team2Score = Number(second.match_score ?? 0);
  const finishedAt = iso(match.finished_time || match.started_time || match.scheduled_time);

  return {
    id: match.id,
    championship_id: match.championship_id || null,
    competition_name: CHAMPIONSHIP_NAMES[match.championship_id] || "ESEA League",
    status: match.status || "MATCH_STATUS_FINISHED",
    best_of: match.best_of ?? null,
    scheduled_at: iso(match.scheduled_time) || finishedAt,
    started_at: iso(match.started_time),
    finished_at: finishedAt,
    team1_id: first.premade_team_id || null,
    team1_name: firstLocal?.name || first.name || "Unknown",
    team1_slug: firstLocal?.slug || null,
    team1_logo: firstLocal?.logo || first.avatar || null,
    team1_score: team1Score,
    team2_id: second.premade_team_id || null,
    team2_name: secondLocal?.name || second.name || "Unknown",
    team2_slug: secondLocal?.slug || null,
    team2_logo: secondLocal?.logo || second.avatar || null,
    team2_score: team2Score,
    winner_id: first.won ? first.premade_team_id : second.won ? second.premade_team_id : team1Score > team2Score ? first.premade_team_id : team2Score > team1Score ? second.premade_team_id : null,
    faceit_url: `https://www.faceit.com/en/cs2/room/${match.id}`,
    maps: mapScores.map((map) => map.map),
    map_scores: mapScores,
    raw_data: match,
    updated_at: new Date().toISOString(),
  };
}

async function fetchTeamMatches(team) {
  if (!team.faceitTeamId) return [];
  const result = [];
  for (let offset = 0; ; offset += PAGE_LIMIT) {
    const response = await fetch(buildUrl(team.faceitTeamId, offset), {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    const payload = Array.isArray(data.payload) ? data.payload : [];
    result.push(...payload);
    console.log(`${team.name}: received ${payload.length}, total ${result.length}`);
    if (payload.length < PAGE_LIMIT) break;
    await sleep(150);
  }
  return result;
}

async function upsertRows(rows) {
  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE);
    const { error } = await supabase.from("matches").upsert(batch, { onConflict: "id" });
    if (error) throw error;
    console.log(`Supabase matches: ${Math.min(index + batch.length, rows.length)}/${rows.length}`);
  }
}

async function main() {
  const unique = new Map();
  for (let index = 0; index < teams.length; index += 1) {
    const team = teams[index];
    try {
      const payload = await fetchTeamMatches(team);
      for (const rawMatch of payload) {
        const row = normalizeMatch(rawMatch);
        if (row) unique.set(row.id, row);
      }
      console.log(`[${index + 1}/${teams.length}] ${team.name}: unique matches ${unique.size}`);
    } catch (error) {
      console.error(`[${index + 1}/${teams.length}] FAILED ${team.name}: ${error.message}`);
    }
    await sleep(TEAM_DELAY_MS);

    // Сбрасываем накопленное в БД каждые 1000 матчей, чтобы не держать всё в памяти.
    if (unique.size >= 1000) {
      await upsertRows([...unique.values()]);
      unique.clear();
    }
  }
  if (unique.size) await upsertRows([...unique.values()]);
  console.log("DONE: finished matches are stored in Supabase");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
