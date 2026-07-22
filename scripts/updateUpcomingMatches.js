import fs from "fs/promises";
import teams from "../src/data/teams.generated.js";

const CHAMPIONSHIP_IDS = [

  // EU ECL S52 Cup 1 - Playoffs
  "6c713b0c-dd31-4bd8-9571-484f84a5272d",

  // Advanced Regular S58
  "f404458c-3ff0-4b6a-abdf-89a6b13694ca",

  // Main Regular S58
  "54f32bd1-55d3-4353-8818-79f57ef7a65b", // Main A reg
  "8961a4f3-2860-4545-87db-1ce1e32c7e13", // Main B reg

  // Intermediate Regular S58
  "de368982-42fc-428e-9d2e-cfdbaa7d6363", // Intermediate A reg
  "b453b0b9-f5e5-4f08-964d-d127691243d0", // Intermediate B reg

  // Entry Regular S58
  "df648492-2f7f-44ac-abbe-1d179a38d7c3", // Entry A reg
  "c1641aae-0e63-4564-a571-927091687b5b", // Entry B reg
  "4cc00188-c9af-472d-b2cc-d60091f9834e", // Entry C reg
  "dde840d0-cb47-49c9-9ac4-a51a11991c42", // Entry D reg

// Esea Finals S57
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

const OUTPUT_PATH = "src/data/upcomingMatches.js";

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
  params.set("status", "MATCH_STATUS_SCHEDULED");
  params.set("offset", String(offset));
  params.set("limit", String(limit));

  return `https://www.faceit.com/api/team-leagues/v2/matches?${params.toString()}`;
}

const CHAMPIONSHIP_NAMES = {

  // EU ECL S52 (Esea S58))
  "6c713b0c-dd31-4bd8-9571-484f84a5272d":
    "EU ECL S52 Cup 1 - Playoffs",

  // Advanced S58
  "f404458c-3ff0-4b6a-abdf-89a6b13694ca":
    "S58 EU Advanced Central - Regular Season",

  // Main S58
  "54f32bd1-55d3-4353-8818-79f57ef7a65b":
    "S58 EU Main A - Regular Season",
  "8961a4f3-2860-4545-87db-1ce1e32c7e13":
    "S58 EU Main B - Regular Season",

  // Intermediate S58
  "de368982-42fc-428e-9d2e-cfdbaa7d6363":
    "S58 EU Intermediate A - Regular Season",
  "b453b0b9-f5e5-4f08-964d-d127691243d0":
    "S58 EU Intermediate B - Regular Season",

   // Entry S58
  "df648492-2f7f-44ac-abbe-1d179a38d7c3":
    "S58 EU Entry A - Regular Season",
  "c1641aae-0e63-4564-a571-927091687b5b":
    "S58 EU Entry B - Regular Season",
  "4cc00188-c9af-472d-b2cc-d60091f9834e":
    "S58 EU Entry C - Regular Season",
  "dde840d0-cb47-49c9-9ac4-a51a11991c42":
    "S58 EU Entry D - Regular Season",

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

function findLocalTeam(faceitTeamId) {
  return teams.find(
    (team) => team.faceitTeamId === faceitTeamId
  );
}

function normalizeFaction(faction) {
  const localTeam = findLocalTeam(
    faction?.premade_team_id
  );

  return {
    id:
      faction?.premade_team_id ||
      faction?.id ||
      null,

    name:
      localTeam?.name ||
      faction?.name ||
      faction?.nickname ||
      "TBD",

    slug:
      localTeam?.slug ||
      null,

    logo:
      localTeam?.logo ||
      faction?.avatar ||
      faction?.logo ||
      null,
  };
}

function normalizeMatch(match) {
  const factions = match.factions || [];

  if (factions.length < 2) {
    return null;
  }

  const firstFaction = factions[0];
  const secondFaction = factions[1];



  const rawDate =
    match.scheduled_time ||
    match.started_time;

  if (!rawDate) {
    return null;
  }

  const scheduledAt = new Date(rawDate);

  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  return {
    id: match.id,
    matchId: match.id,

    status: match.status,
    bestOf: match.best_of ?? null,

    championshipId: match.championship_id,

    season:
      CHAMPIONSHIP_NAMES[match.championship_id] ||
      "ESEA League",

    scheduledAt: scheduledAt.toISOString(),

team1: normalizeFaction(firstFaction),
team2: normalizeFaction(secondFaction),

    faceitUrl:
      `https://www.faceit.com/en/cs2/room/${match.id}`,
  };
}

async function fetchTeamMatches(team) {
  if (!team.faceitTeamId) {
    console.log(`SKIP ${team.name}: no faceitTeamId`);
    return [];
  }

  const url = buildUrl(team.faceitTeamId);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      console.log(`ERROR ${team.name}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const payload = data.payload || [];

    console.log(
      `${team.name}: ${payload.length} upcoming matches`
    );

    return payload;
  } catch (error) {
    console.log(
      `FAILED ${team.name}: ${error.message}`
    );

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

  const uniqueMatches = new Map();

  for (const match of allMatches) {
    if (!match?.id) {
      continue;
    }

    uniqueMatches.set(match.id, match);
  }

  const now = Date.now();
  const next24Hours =
    now + 24 * 60 * 60 * 1000;

  const result = [...uniqueMatches.values()]
    .map(normalizeMatch)
    .filter(Boolean)
    .filter((match) => {
      const matchTime =
        new Date(match.scheduledAt).getTime();

      return (
        matchTime >= now &&
        matchTime <= next24Hours
      );
    })
    .sort(
      (firstMatch, secondMatch) =>
        new Date(firstMatch.scheduledAt) -
        new Date(secondMatch.scheduledAt)
    );

  const file = `const upcomingMatches = ${JSON.stringify(
    result,
    null,
    2
  )};

export default upcomingMatches;
`;

  await fs.writeFile(
    OUTPUT_PATH,
    file,
    "utf8"
  );

  console.log(
    `Saved ${result.length} matches to ${OUTPUT_PATH}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});