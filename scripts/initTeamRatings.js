import { createClient } from "@supabase/supabase-js";

import teams from "../src/data/teams.generated.js";
import {
  getInitialPoints,
  normalizeDivisionName,
} from "../src/utils/teamRating.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL отсутствует в .env.local");
}

if (!supabaseSecretKey) {
  throw new Error(
    "SUPABASE_SECRET_KEY или SUPABASE_SERVICE_ROLE_KEY отсутствует в .env.local",
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const BATCH_SIZE = 200;

function prepareTeam(team) {
  const teamId =
    team.faceitTeamId ||
    team.leagueTeamId ||
    team.slug;

  if (!teamId) {
    return null;
  }

  const division = normalizeDivisionName(
    team.division,
  );

  const initialPoints = getInitialPoints(
    division,
  );

  return {
    team_id: String(teamId),
    team_name:
      team.name ||
      team.slug ||
      "Unknown Team",

    slug: team.slug || null,
    division,

    points: initialPoints,
    previous_points: initialPoints,
    points_change: 0,

    matches_played: 0,
    ranking_status: "unranked",

    updated_at: new Date().toISOString(),
  };
}

async function getExistingTeamIds() {
  const existingIds = new Set();

  let from = 0;
  const pageSize = 1000;

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("team_ratings")
      .select("team_id")
      .range(from, to);

    if (error) {
      throw new Error(
        `Не удалось прочитать team_ratings: ${error.message}`,
      );
    }

    for (const row of data || []) {
      existingIds.add(String(row.team_id));
    }

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return existingIds;
}

async function insertBatch(rows) {
  const { error } = await supabase
    .from("team_ratings")
    .insert(rows);

  if (error) {
    throw new Error(
      `Ошибка вставки рейтинга: ${error.message}`,
    );
  }
}

async function main() {
  console.log(
    `Команд в teams.generated.js: ${teams.length}`,
  );

  const existingIds =
    await getExistingTeamIds();

  console.log(
    `Команд уже есть в team_ratings: ${existingIds.size}`,
  );

  const prepared = teams
    .map(prepareTeam)
    .filter(Boolean);

  const uniqueTeams = Array.from(
    new Map(
      prepared.map((team) => [
        team.team_id,
        team,
      ]),
    ).values(),
  );

  const newTeams = uniqueTeams.filter(
    (team) =>
      !existingIds.has(String(team.team_id)),
  );

  console.log(
    `Новых команд для добавления: ${newTeams.length}`,
  );

  if (newTeams.length === 0) {
    console.log(
      "Все команды уже добавлены. Ничего менять не нужно.",
    );
    return;
  }

  let inserted = 0;

  for (
    let index = 0;
    index < newTeams.length;
    index += BATCH_SIZE
  ) {
    const batch = newTeams.slice(
      index,
      index + BATCH_SIZE,
    );

    await insertBatch(batch);

    inserted += batch.length;

    console.log(
      `Добавлено ${inserted}/${newTeams.length}`,
    );
  }

  const divisionStats = newTeams.reduce(
    (result, team) => {
      const key =
        `${team.division}: ${team.points}`;

      result[key] = (result[key] || 0) + 1;

      return result;
    },
    {},
  );

  console.log("\nРаспределение новых команд:");

  for (const [division, count] of Object.entries(
    divisionStats,
  )) {
    console.log(`${division} points — ${count}`);
  }

  console.log(
    `\nГотово. Добавлено команд: ${inserted}`,
  );
}

main().catch((error) => {
  console.error("\nОшибка инициализации рейтинга:");
  console.error(error);

  process.exitCode = 1;
});