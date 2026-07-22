import fs from "fs/promises";
import { createClient } from "@supabase/supabase-js";
import teams from "../src/data/teams.generated.js";

const CHAMPIONSHIP_IDS = [
  // =========================
  // S58 — EUROPE
  // =========================

  // EU ECL S52 Cup 1 - Playoffs
  "6c713b0c-dd31-4bd8-9571-484f84a5272d",

  // Advanced
  "f404458c-3ff0-4b6a-abdf-89a6b13694ca",

  // Main
  "54f32bd1-55d3-4353-8818-79f57ef7a65b",
  "8961a4f3-2860-4545-87db-1ce1e32c7e13",

  // Intermediate
  "de368982-42fc-428e-9d2e-cfdbaa7d6363",
  "b453b0b9-f5e5-4f08-964d-d127691243d0",

  // Entry
  "df648492-2f7f-44ac-abbe-1d179a38d7c3",
  "c1641aae-0e63-4564-a571-927091687b5b",
  "4cc00188-c9af-472d-b2cc-d60091f9834e",
  "dde840d0-cb47-49c9-9ac4-a51a11991c42",

  // =========================
  // S58 — NORTH AMERICA
  // =========================

  // Advanced
  "3481bbef-1c65-415d-8686-4c0474714dad",
  "6b344cab-2163-4622-ae13-fc41af4624d2",

  // Main
  "2173e911-8a3c-45d8-a929-f803fee740ba",
  "33c94aa7-6909-4b03-a8d8-cac136e7274e",
  "2f0c0f91-3c94-44fe-a74f-9b00cffce0b8",

  // Intermediate
  "f03afa24-ad7f-47a1-8f54-9c2fa1c10ff7",
  "be8ec630-aceb-4f51-8ba6-636376ad337f",
  "eeec1355-3f55-4e14-be97-0d5b9277510e",
  "669f789a-8289-4a3b-a6bb-67ba2ac0fd24",

  // =========================
  // S58 — SOUTH AMERICA
  // =========================

  "9b6defd0-383e-46b6-9cc8-3c265e289ddd",
  "f95c9a05-60f2-41a3-9b57-7321997c82e5",

  // =========================
  // S58 — OCEANIA
  // =========================

  "48a763ab-7e43-4d3c-96c1-0cceb5a85e87",
  "0c373a1e-67d3-4e6b-9acc-20a3409dad27",

  // =========================
  // S58 — ASIA
  // =========================

  "83873077-a11b-40a1-8d41-df87d6754c59",
  "22a382e1-c7c5-46f7-a137-d48a686990f9",

  // =========================
  // S57 — EUROPE
  // =========================

  // ESEA Finals
  "cb6bfac6-dc14-4995-a170-909392cec298",

  // Advanced
  "f6d5875a-af46-45f3-9db2-343e3aa974ec",
  "c44e1453-8043-41fe-8b4e-d9f9ac132f40",

  // Main
  "83fc05fb-0f31-42e3-82c3-96c6dc16660a",
  "93ab0270-1ee0-42bc-b3df-32ec40d74078",
  "3889301e-0a67-4fa2-bed7-4a6ffb6de3fa",
  "2a658dac-a1fa-4adb-bff0-f4fb9d9f2f74",

  // Intermediate
  "106062e2-b895-4485-9eba-0fc33964928e",
  "a96a8895-6f83-4d47-8877-c036d83be418",
  "6faf7269-8a1b-4403-ae45-d2a9fa8cbb8e",
  "88e1f562-e95b-4e80-b196-111aabbbf7cc",
  "af4ebc04-acf2-4785-b98d-47ec1e37706e",
  "717e14e8-5da6-4d21-ac8a-3df742e8c855",
  "7dfdafbe-2898-43e4-ba19-68d3a0e6c64e",
  "9523d8b6-4173-48be-9407-76d587b9d8d4",

  // Entry
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
  // =========================
  // S58 — EUROPE
  // =========================

  "6c713b0c-dd31-4bd8-9571-484f84a5272d":
    "EU ECL S52 Cup 1 - Playoffs",

  "f404458c-3ff0-4b6a-abdf-89a6b13694ca":
    "S58 EU Advanced Central - Regular Season",

  "54f32bd1-55d3-4353-8818-79f57ef7a65b":
    "S58 EU Main A - Regular Season",
  "8961a4f3-2860-4545-87db-1ce1e32c7e13":
    "S58 EU Main B - Regular Season",

  "de368982-42fc-428e-9d2e-cfdbaa7d6363":
    "S58 EU Intermediate A - Regular Season",
  "b453b0b9-f5e5-4f08-964d-d127691243d0":
    "S58 EU Intermediate B - Regular Season",

  "df648492-2f7f-44ac-abbe-1d179a38d7c3":
    "S58 EU Entry A - Regular Season",
  "c1641aae-0e63-4564-a571-927091687b5b":
    "S58 EU Entry B - Regular Season",
  "4cc00188-c9af-472d-b2cc-d60091f9834e":
    "S58 EU Entry C - Regular Season",
  "dde840d0-cb47-49c9-9ac4-a51a11991c42":
    "S58 EU Entry D - Regular Season",

  // =========================
  // S58 — NORTH AMERICA
  // =========================

  "3481bbef-1c65-415d-8686-4c0474714dad":
    "S58 NA Advanced - Regular Season",
  "6b344cab-2163-4622-ae13-fc41af4624d2":
    "S58 NA Advanced - Playoffs",

  "2173e911-8a3c-45d8-a929-f803fee740ba":
    "S58 NA Main A - Regular Season",
  "33c94aa7-6909-4b03-a8d8-cac136e7274e":
    "S58 NA Main B - Regular Season",
  "2f0c0f91-3c94-44fe-a74f-9b00cffce0b8":
    "S58 NA Main - Playoffs",

  "f03afa24-ad7f-47a1-8f54-9c2fa1c10ff7":
    "S58 NA Intermediate A - Regular Season",
  "be8ec630-aceb-4f51-8ba6-636376ad337f":
    "S58 NA Intermediate B - Regular Season",
  "eeec1355-3f55-4e14-be97-0d5b9277510e":
    "S58 NA Intermediate A - Playoffs",
  "669f789a-8289-4a3b-a6bb-67ba2ac0fd24":
    "S58 NA Intermediate B - Playoffs",

  // =========================
  // S58 — SOUTH AMERICA
  // =========================

  "9b6defd0-383e-46b6-9cc8-3c265e289ddd":
    "S58 SA Open - Regular Season",
  "f95c9a05-60f2-41a3-9b57-7321997c82e5":
    "S58 SA Open - Playoffs",

  // =========================
  // S58 — OCEANIA
  // =========================

  "48a763ab-7e43-4d3c-96c1-0cceb5a85e87":
    "S58 OCE Intermediate - Regular Season",
  "0c373a1e-67d3-4e6b-9acc-20a3409dad27":
    "S58 OCE Intermediate - Playoffs",

  // =========================
  // S58 — ASIA
  // =========================

  "83873077-a11b-40a1-8d41-df87d6754c59":
    "S58 Asia Open - Regular Season",
  "22a382e1-c7c5-46f7-a137-d48a686990f9":
    "S58 Asia Open - Playoffs",

  // =========================
  // S57 — EUROPE
  // =========================

  "cb6bfac6-dc14-4995-a170-909392cec298":
    "ESEA Finals S57",

  "c44e1453-8043-41fe-8b4e-d9f9ac132f40":
    "S57 EU Advanced Central - Regular Season",
  "f6d5875a-af46-45f3-9db2-343e3aa974ec":
    "S57 EU Advanced Central - Playoffs",

  "83fc05fb-0f31-42e3-82c3-96c6dc16660a":
    "S57 EU Main A - Regular Season",
  "93ab0270-1ee0-42bc-b3df-32ec40d74078":
    "S57 EU Main B - Regular Season",
  "3889301e-0a67-4fa2-bed7-4a6ffb6de3fa":
    "S57 EU Main A - Playoffs",
  "2a658dac-a1fa-4adb-bff0-f4fb9d9f2f74":
    "S57 EU Main B - Playoffs",

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

const OUTPUT_PATH = "src/data/matches.js";

const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL отсутствует в .env.local");
}

if (!SUPABASE_KEY) {
  throw new Error(
    "Нужен SUPABASE_SECRET_KEY или SUPABASE_SERVICE_ROLE_KEY в .env.local",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const SUPABASE_BATCH_SIZE = 200;

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


function findKnownTeam(faceitTeamId) {
  if (!faceitTeamId) return null;

  return (
    teams.find(
      (team) =>
        String(team.faceitTeamId || "") ===
        String(faceitTeamId),
    ) || null
  );
}

function getFactionMapScores(faction, opponentFaction) {
  return (
    faction?.map_scores?.map((map, index) => ({
      map:
        map.map_name ||
        map.map ||
        map.name ||
        "unknown",

      teamScore:
        map.score === null ||
        map.score === undefined
          ? null
          : Number(map.score),

      opponentScore:
        opponentFaction?.map_scores?.[index]
          ?.score === null ||
        opponentFaction?.map_scores?.[index]
          ?.score === undefined
          ? null
          : Number(
              opponentFaction.map_scores[index]
                .score,
            ),

      won: Boolean(map.won),
    })) || []
  );
}

function buildSupabaseRow(match) {
  const factions = Array.isArray(match.factions)
    ? match.factions
    : [];

  if (factions.length < 2) {
    return null;
  }

  const team1 = factions[0];
  const team2 = factions[1];

  const team1Known = findKnownTeam(
    team1.premade_team_id,
  );

  const team2Known = findKnownTeam(
    team2.premade_team_id,
  );

  const scheduledAt =
    match.scheduled_time || null;

  const finishedAt =
    match.finished_time ||
    match.started_time ||
    match.scheduled_time ||
    null;

  const mapScores = getFactionMapScores(
    team1,
    team2,
  );

  const mapNames = (
    match.maps_picked || []
  )
    .map((map) => map?.name)
    .filter(Boolean);

  /*
   * Основные поля существуют в текущей таблице
   * matches и используются страницей матчей и
   * пересчетом рейтинга.
   */
  return {
    id: match.id,

    competition_name:
      CHAMPIONSHIP_NAMES[
        match.championship_id
      ] ||
      `Unknown championship ${match.championship_id}`,

    status:
      match.status ||
      "MATCH_STATUS_FINISHED",

    best_of:
      Number(match.best_of) || 1,

    scheduled_at: scheduledAt,
    finished_at: finishedAt,

    team1_id:
      team1.premade_team_id || null,

    team1_name:
      team1.name ||
      team1Known?.name ||
      "Unknown",

    team1_slug:
      team1Known?.slug || null,

    team1_score:
      team1.match_score === null ||
      team1.match_score === undefined
        ? null
        : Number(team1.match_score),

    team2_id:
      team2.premade_team_id || null,

    team2_name:
      team2.name ||
      team2Known?.name ||
      "Unknown",

    team2_slug:
      team2Known?.slug || null,

    team2_score:
      team2.match_score === null ||
      team2.match_score === undefined
        ? null
        : Number(team2.match_score),

    championship_id:
      match.championship_id || null,

    maps: mapNames,
    map_scores: mapScores,

    faceit_url:
      `https://www.faceit.com/en/cs2/room/${match.id}`,

    updated_at: new Date().toISOString(),
  };
}

function getCoreSupabaseRow(row) {
  /*
   * Если в старой схеме нет некоторых
   * дополнительных колонок, скрипт повторит
   * запись только с гарантированно используемыми
   * полями.
   */
  return {
    id: row.id,
    competition_name:
      row.competition_name,
    status: row.status,
    best_of: row.best_of,
    scheduled_at: row.scheduled_at,
    finished_at: row.finished_at,
    team1_id: row.team1_id,
    team1_name: row.team1_name,
    team1_score: row.team1_score,
    team2_id: row.team2_id,
    team2_name: row.team2_name,
    team2_score: row.team2_score,
  };
}

async function upsertSupabaseMatches(rows) {
  if (rows.length === 0) {
    console.log(
      "Supabase: нет матчей для записи",
    );
    return;
  }

  console.log(
    `Supabase: начинаю запись ${rows.length} матчей`,
  );

  let written = 0;
  let usedCoreFallback = false;

  for (
    let index = 0;
    index < rows.length;
    index += SUPABASE_BATCH_SIZE
  ) {
    const batch = rows.slice(
      index,
      index + SUPABASE_BATCH_SIZE,
    );

    let { error } = await supabase
      .from("matches")
      .upsert(batch, {
        onConflict: "id",
      });

    /*
     * Поддержка более старой схемы таблицы.
     * При отсутствии maps, map_scores,
     * championship_id, faceit_url и т. п.
     * повторяем batch с базовым набором полей.
     */
    if (error) {
      console.warn(
        `Supabase: расширенная запись не удалась: ${error.message}`,
      );

      const coreBatch = batch.map(
        getCoreSupabaseRow,
      );

      const fallbackResult = await supabase
        .from("matches")
        .upsert(coreBatch, {
          onConflict: "id",
        });

      error = fallbackResult.error;
      usedCoreFallback = true;
    }

    if (error) {
      throw new Error(
        `Ошибка записи matches в Supabase: ${error.message}`,
      );
    }

    written += batch.length;

    console.log(
      `Supabase: записано ${written}/${rows.length}`,
    );
  }

  if (usedCoreFallback) {
    console.log(
      "Supabase: использована совместимая запись с базовыми колонками.",
    );
  }

  console.log(
    `Supabase: готово, обработано ${written} матчей`,
  );
}

function normalizeMatch(match, team) {
  const myFaction = match.factions?.find(
    (faction) => faction.premade_team_id === team.faceitTeamId,
  );

  const enemyFaction = match.factions?.find(
    (faction) => faction.premade_team_id !== team.faceitTeamId,
  );

  const date =
    match.finished_time ||
    match.started_time ||
    match.scheduled_time;

  if (!date) {
    return null;
  }

  const rawMapScores =
    myFaction?.map_scores?.map((map, index) => ({
      map: map.map_name,
      teamScore: map.score,
      opponentScore:
        enemyFaction?.map_scores?.[index]?.score ?? null,
      won: map.won,
    })) || [];

  const isTechnicalMatch =
    rawMapScores.length === 0 ||
    rawMapScores.some((map) => map.map === "unknown") ||
    rawMapScores.some(
      (map) =>
        (map.teamScore === 1 && map.opponentScore === 0) ||
        (map.teamScore === 0 && map.opponentScore === 1),
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
      `Unknown championship ${match.championship_id}`,

    date: new Date(date).toISOString().slice(0, 10),

    status: match.status,
    bestOf: match.best_of,

    championshipId: match.championship_id,

    maps: match.maps_picked?.map((map) => map.name) || [],
    mapScores: rawMapScores,

    faceitUrl: `https://www.faceit.com/en/cs2/room/${match.id}`,
  };
}

async function fetchTeamMatches(team) {
  if (!team.faceitTeamId) {
    console.log(`SKIP ${team.name}: no faceitTeamId`);
    return { matches: [], supabaseRows: [] };
  }

  const limit = 40;
  let offset = 0;
  const allPayload = [];

  try {
    while (true) {
      const url = buildUrl(team.faceitTeamId, offset, limit);

      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "Mozilla/5.0",
        },
      });

      if (!response.ok) {
        console.log(
          `ERROR ${team.name}: ${response.status}, offset ${offset}`,
        );
        break;
      }

      const data = await response.json();

      const payload = Array.isArray(data.payload)
        ? data.payload
        : [];

      allPayload.push(...payload);

      console.log(
        `${team.name}: received ${payload.length}, total ${allPayload.length}`,
      );

      if (payload.length < limit) {
        break;
      }

      offset += limit;
      await sleep(150);
    }

    const matches = allPayload
      .map((match) => normalizeMatch(match, team))
      .filter(Boolean);

    const supabaseRows = allPayload
      .map(buildSupabaseRow)
      .filter(Boolean);

    console.log(
      `${team.name}: saved ${matches.length} of ${allPayload.length}`,
    );

    return {
      matches,
      supabaseRows,
    };
  } catch (error) {
    console.log(`FAILED ${team.name}: ${error.message}`);
    return { matches: [], supabaseRows: [] };
  }
}

async function main() {
  const allMatches = [];
  const allSupabaseRows = [];

  for (const team of teams) {
    const result =
      await fetchTeamMatches(team);

    allMatches.push(
      ...result.matches,
    );

    allSupabaseRows.push(
      ...result.supabaseRows,
    );

    await sleep(250);
  }

  /*
   * Локальный matches.js хранит отдельное
   * представление матча для каждой команды.
   */
  const uniqueLocalMatches = new Map();

  for (const match of allMatches) {
    uniqueLocalMatches.set(
      `${match.id}-${match.teamSlug}`,
      match,
    );
  }

  const localResult = [
    ...uniqueLocalMatches.values(),
  ].sort(
    (first, second) =>
      new Date(second.date) -
      new Date(first.date),
  );

  const file = `const matches = ${JSON.stringify(
    localResult,
    null,
    2,
  )};

export default matches;
`;

  await fs.writeFile(
    OUTPUT_PATH,
    file,
    "utf8",
  );

  console.log(
    `Local: saved ${localResult.length} matches to ${OUTPUT_PATH}`,
  );

  /*
   * В Supabase каждый физический матч
   * должен храниться ровно один раз.
   */
  const uniqueSupabaseRows = new Map();

  for (const row of allSupabaseRows) {
    uniqueSupabaseRows.set(
      row.id,
      row,
    );
  }

  const supabaseRows = [
    ...uniqueSupabaseRows.values(),
  ].sort(
    (first, second) =>
      new Date(
        first.finished_at ||
          first.scheduled_at ||
          0,
      ) -
      new Date(
        second.finished_at ||
          second.scheduled_at ||
          0,
      ),
  );

  console.log(
    `Supabase: уникальных матчей ${supabaseRows.length}`,
  );

  await upsertSupabaseMatches(
    supabaseRows,
  );

  console.log("\nПолная синхронизация завершена.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
