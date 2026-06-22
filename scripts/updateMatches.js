import fs from "fs/promises";
import teams from "../src/data/teams.js";

const CHAMPIONSHIP_IDS = [

// Esea Finals
"cb6bfac6-dc14-4995-a170-909392cec298",
  
// Advanced Playoffs
  "f6d5875a-af46-45f3-9db2-343e3aa974ec",
  // Advanced Regular
  "c44e1453-8043-41fe-8b4e-d9f9ac132f40",
  
  // Main Regular
  "83fc05fb-0f31-42e3-82c3-96c6dc16660a", // Main A reg
  "93ab0270-1ee0-42bc-b3df-32ec40d74078", // Main B reg

  // Main Playoffs
  "3889301e-0a67-4fa2-bed7-4a6ffb6de3fa", // Main A playoff
  "2a658dac-a1fa-4adb-bff0-f4fb9d9f2f74", // Main B playoff

  // Intermediate Regular
  "106062e2-b895-4485-9eba-0fc33964928e", // Intermediate A reg
  "a96a8895-6f83-4d47-8877-c036d83be418", // Intermediate B reg
  "6faf7269-8a1b-4403-ae45-d2a9fa8cbb8e", // Intermediate C reg
  "88e1f562-e95b-4e80-b196-111aabbbf7cc", // Intermediate D reg

  // Intermediate Playoffs
  "af4ebc04-acf2-4785-b98d-47ec1e37706e", // Intermediate A playoff
  "717e14e8-5da6-4d21-ac8a-3df742e8c855", // Intermediate B playoff
  "7dfdafbe-2898-43e4-ba19-68d3a0e6c64e", // Intermediate C playoff
  "9523d8b6-4173-48be-9407-76d587b9d8d4", // Intermediate D playoff

  // Entry Regular
  "62990daa-bd22-4e2c-be51-df8a117d8ab7", // Entry A reg
  "966da0d9-7d3c-4238-b0da-82e37ba3c105", // Entry B reg
  "045a2e2a-394d-4d2b-8ff3-4deab0227bd4", // Entry C reg
  "6f84ee24-dc39-4c9a-b303-e765f1153f20", // Entry D reg

  // Entry Playoffs
  "51706dfb-c98b-4471-8aed-c406f1b99970", // Entry A playoff
  "b3d1f519-1524-45ca-a7d8-fd83f3419202", // Entry B playoff
  "56253486-2d88-4512-9649-6296f50a38b9", // Entry C playoff
  "86555399-fcc9-4094-9b67-8e8d9c2405b5", // Entry D playoff
];

const OUTPUT_PATH = "src/data/matches.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(teamId, offset = 0, limit = 40) {
  const params = new URLSearchParams();

  for (const id of CHAMPIONSHIP_IDS) {
    params.append("championship_ids", id);
  }

  params.set("entityId", teamId);
  params.set("entityType", "PREMADE_TEAM");
  params.set("status", "MATCH_STATUS_FINISHED");
  params.set("offset", String(offset));
  params.set("limit", String(limit));

  return `https://www.faceit.com/api/team-leagues/v2/matches?${params.toString()}`;
}

const CHAMPIONSHIP_NAMES = {

   "cb6bfac6-dc14-4995-a170-909392cec298":
    "ESEA Finals S57",

  // Advanced
  "c44e1453-8043-41fe-8b4e-d9f9ac132f40":
    "S57 EU Advanced Central - Regular Season",
  "f6d5875a-af46-45f3-9db2-343e3aa974ec":
    "S57 EU Advanced Central - Playoffs",

  // Main
  "83fc05fb-0f31-42e3-82c3-96c6dc16660a":
    "S57 EU Main A - Regular Season",
  "93ab0270-1ee0-42bc-b3df-32ec40d74078":
    "S57 EU Main B - Regular Season",

  "3889301e-0a67-4fa2-bed7-4a6ffb6de3fa":
    "S57 EU Main A - Playoffs",
  "2a658dac-a1fa-4adb-bff0-f4fb9d9f2f74":
    "S57 EU Main B - Playoffs",

  // Intermediate
  "106062e2-b895-4485-9eba-0fc33964928e":
    "S57 EU Intermediate A - Regular Season",
  "a96a8895-6f83-4d47-8877-c036d83be418":
    "S57 EU Intermediate B - Regular Season",
  "6faf7269-8a1b-4403-ae45-d2a9fa8cbb8e":
    "S57 EU Intermediate C - Regular Season",
  "88e1f562-e95b-4e80-b196-111aabbbf7cc":
    "S57 EU Intermediate D - Regular Season",

  "af4ebc04-acf2-4785-b98d-47ec1e37706e":
    "S57 EU Intermediate A - Playoffs",
  "717e14e8-5da6-4d21-ac8a-3df742e8c855":
    "S57 EU Intermediate B - Playoffs",
  "7dfdafbe-2898-43e4-ba19-68d3a0e6c64e":
    "S57 EU Intermediate C - Playoffs",
  "9523d8b6-4173-48be-9407-76d587b9d8d4":
    "S57 EU Intermediate D - Playoffs",

  // Entry
  "62990daa-bd22-4e2c-be51-df8a117d8ab7":
    "S57 EU Entry A - Regular Season",
  "966da0d9-7d3c-4238-b0da-82e37ba3c105":
    "S57 EU Entry B - Regular Season",
  "045a2e2a-394d-4d2b-8ff3-4deab0227bd4":
    "S57 EU Entry C - Regular Season",
  "6f84ee24-dc39-4c9a-b303-e765f1153f20":
    "S57 EU Entry D - Regular Season",

  "51706dfb-c98b-4471-8aed-c406f1b99970":
    "S57 EU Entry A - Playoffs",
  "b3d1f519-1524-45ca-a7d8-fd83f3419202":
    "S57 EU Entry B - Playoffs",
  "56253486-2d88-4512-9649-6296f50a38b9":
    "S57 EU Entry C - Playoffs",
  "86555399-fcc9-4094-9b67-8e8d9c2405b5":
    "S57 EU Entry D - Playoffs",
};

function normalizeMatch(match, team) {
  const myFaction = match.factions?.find(
    (f) => f.premade_team_id === team.faceitTeamId
  );

  const enemyFaction = match.factions?.find(
    (f) => f.premade_team_id !== team.faceitTeamId
  );

  const date =
    match.finished_time ||
    match.started_time ||
    match.scheduled_time;

  const rawMapScores =
    myFaction?.map_scores?.map((map, index) => ({
      map: map.map_name,
      teamScore: map.score,
      opponentScore:
        enemyFaction?.map_scores?.[index]?.score ?? null,
      won: map.won,
    })) || [];

  // Фильтр техлузов / техвинов
  const isTechnicalMatch =
    rawMapScores.length === 0 ||
    rawMapScores.some((m) => m.map === "unknown") ||
    rawMapScores.some(
      (m) =>
        (m.teamScore === 1 && m.opponentScore === 0) ||
        (m.teamScore === 0 && m.opponentScore === 1)
    );

  if (isTechnicalMatch) {
    return null;
  }

  let boScore = "0 : 0";

  if (match.best_of === 1) {
    const firstMap = rawMapScores[0];

    if (firstMap) {
      boScore = `${firstMap.teamScore} : ${firstMap.opponentScore}`;
    }
  } else {
    boScore = `${myFaction?.match_score ?? 0} : ${
      enemyFaction?.match_score ?? 0
    }`;
  }

  return {
    id: match.id,
    matchId: match.id,

    teamSlug: team.slug,
    teamName: team.name,
    opponentName: enemyFaction?.name || "Unknown",

    teamScore: myFaction?.match_score ?? null,
    opponentScore: enemyFaction?.match_score ?? null,

    won: myFaction?.won ?? false,

    result: myFaction?.won ? "WIN" : "LOSS",

    boScore,

    season:
      CHAMPIONSHIP_NAMES[match.championship_id] ||
      "Season 57",

    date: new Date(date).toISOString().slice(0, 10),

    status: match.status,
    bestOf: match.best_of,

    championshipId: match.championship_id,

    maps: match.maps_picked?.map((m) => m.name) || [],

    mapScores: rawMapScores,

    faceitUrl: `https://www.faceit.com/en/cs2/room/${match.id}`,
  };
}

async function fetchTeamMatches(team) {
  if (!team.faceitTeamId) {
    console.log(`SKIP ${team.name}: no faceitTeamId`);
    return [];
  }

  const url = buildUrl(team.faceitTeamId);

  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) {
      console.log(`ERROR ${team.name}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const payload = data.payload || [];

    console.log(`${team.name}: ${payload.length} matches`);

    return payload
  .map((match) => normalizeMatch(match, team))
  .filter(Boolean);
  } catch (err) {
    console.log(`FAILED ${team.name}: ${err.message}`);
    return [];
  }
}

async function main() {
  const allMatches = [];

  for (const team of teams) {
    const matches = await fetchTeamMatches(team);
    allMatches.push(...matches);

    await sleep(250);
  }

  const unique = new Map();

  for (const match of allMatches) {
    unique.set(`${match.id}-${match.teamSlug}`, match);
  }

  const result = [...unique.values()].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  const file = `const matches = ${JSON.stringify(result, null, 2)};

export default matches;
`;

  await fs.writeFile(OUTPUT_PATH, file, "utf8");

  console.log(`Saved ${result.length} matches to ${OUTPUT_PATH}`);
}

main();