import { createClient } from "@supabase/supabase-js";

import {
  calculateMatchRating,
  getInitialPoints,
  normalizeDivisionName,
  normalizeRegionName,
} from "../src/utils/teamRating.js";

const supabaseUrl = process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL отсутствует в .env.local");
}

if (!supabaseKey) {
  throw new Error(
    "Нужен SUPABASE_SECRET_KEY или SUPABASE_SERVICE_ROLE_KEY в .env.local",
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 200;

const APPLY_CHANGES = process.argv.includes("--apply");

async function fetchAllRows({
  table,
  select,
  orderColumn,
  ascending = true,
  filters = [],
}) {
  const result = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from(table)
      .select(select)
      .range(from, to);

    for (const filter of filters) {
      if (filter.type === "eq") {
        query = query.eq(
          filter.column,
          filter.value,
        );
      }

      if (filter.type === "notNull") {
        query = query.not(
          filter.column,
          "is",
          null,
        );
      }

      if (filter.type === "ilike") {
        query = query.ilike(
          filter.column,
          filter.value,
        );
      }

      if (filter.type === "in") {
        query = query.in(
          filter.column,
          filter.value,
        );
      }
    }

    if (orderColumn) {
      query = query.order(orderColumn, {
        ascending,
        nullsFirst: false,
      });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Не удалось прочитать ${table}: ${error.message}`,
      );
    }

    const page = Array.isArray(data)
      ? data
      : [];

    result.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return result;
}

function normalizeTeamId(value) {
  return String(value ?? "").trim();
}

/**
 * Нормализует название команды для сопоставления:
 *
 * "  NEW   VISION " → "new vision"
 * "Café Team"       → "cafe team"
 */
function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isPlaceholderName(value) {
  const name = normalizeTeamName(value);

  return (
    !name ||
    name === "tbd" ||
    name === "bye" ||
    name === "unknown" ||
    name === "null" ||
    name === "walkover"
  );
}

function getMatchDivision(match) {
  return normalizeDivisionName(
    match.competition_name,
  );
}

function getMatchRegion(match) {
  return normalizeRegionName(
    match.competition_name,
  );
}

/*
 * Технический результат определяется консервативно:
 * - матч завершен;
 * - обе команды известны;
 * - счет серии 1:0;
 * - формат матча BO3/BO5.
 *
 * Для BO1 счет 1:0 является обычным результатом серии,
 * поэтому автоматически техническим не считается.
 */
function isTechnicalResult(match, series) {
  const bestOf = Number(match.best_of) || 1;

  return (
    bestOf > 1 &&
    series?.winnerScore === 1 &&
    series?.loserScore === 0
  );
}

function normalizeSeriesScore(match) {
  const score1 = Number(match.team1_score);
  const score2 = Number(match.team2_score);
  const bestOf = Number(match.best_of) || 1;

  if (
    !Number.isFinite(score1) ||
    !Number.isFinite(score2) ||
    score1 === score2
  ) {
    return null;
  }

  const team1Won = score1 > score2;

  /*
   * BO1 в базе может храниться как:
   *
   * 1:0
   * 13:9
   * 10:13
   *
   * Для рейтинга это всегда результат серии 1:0.
   */
  if (bestOf <= 1) {
    return {
      winnerScore: 1,
      loserScore: 0,
      team1Won,
    };
  }

  const requiredWins = Math.ceil(bestOf / 2);
  const highScore = Math.max(score1, score2);
  const lowScore = Math.min(score1, score2);

  /*
   * Нормальный счет серии:
   *
   * BO3: 2:0 / 2:1
   * BO5: 3:0 / 3:1 / 3:2
   */
  if (
    highScore <= requiredWins &&
    lowScore < highScore
  ) {
    return {
      winnerScore: highScore,
      loserScore: lowScore,
      team1Won,
    };
  }

  /*
   * Если по ошибке записан счет карты, считаем,
   * что серия была максимально близкой.
   */
  return {
    winnerScore: requiredWins,
    loserScore: Math.max(
      0,
      requiredWins - 1,
    ),
    team1Won,
  };
}

function createInitialRatingState(row) {
  const division = normalizeDivisionName(
    row.division,
  );

  const initialPoints =
    getInitialPoints(division);

  return {
  teamId: normalizeTeamId(row.team_id),
  isCurrentTeam: true,
    teamName: row.team_name,
    normalizedName: normalizeTeamName(
      row.team_name,
    ),
    slug: row.slug,
    division,

    initialPoints,
    points: initialPoints,
    previousPoints: initialPoints,
    pointsChange: 0,
    matchesPlayed: 0,
    rankingStatus: "unranked",

    wins: 0,
    losses: 0,
  };
}

function createHistoricalTeamState({
  teamId,
  teamName,
  division,
}) {
  const normalizedName = normalizeTeamName(teamName);
  const normalizedDivision = normalizeDivisionName(division);

  const generatedId =
    normalizeTeamId(teamId) ||
    `historical:${normalizedDivision}:${normalizedName}`;

  const initialPoints = getInitialPoints(
    normalizedDivision,
  );

  return {
    teamId: generatedId,
    teamName:
      String(teamName ?? "").trim() ||
      "Historical Team",

    normalizedName,
    slug: null,
    division: normalizedDivision,

    isCurrentTeam: false,

    initialPoints,
    points: initialPoints,
    previousPoints: initialPoints,
    pointsChange: 0,
    matchesPlayed: 0,
    rankingStatus: "unranked",

    wins: 0,
    losses: 0,
  };
}

function getMatchTimestamp(match) {
  const date =
    match.finished_at ||
    match.scheduled_at;

  const timestamp = Date.parse(date);

  return Number.isFinite(timestamp)
    ? timestamp
    : Number.MAX_SAFE_INTEGER;
}

/**
 * Создает индекс:
 *
 * normalized team name → массив команд
 *
 * Массив нужен, потому что названия вроде EMPIRE
 * могут встречаться у нескольких команд.
 */
function buildNameIndex(ratings) {
  const byName = new Map();

  for (const team of ratings.values()) {
    if (!team.normalizedName) {
      continue;
    }

    const current =
      byName.get(team.normalizedName) || [];

    current.push(team);

    byName.set(
      team.normalizedName,
      current,
    );
  }

  return byName;
}

/**
 * Ищет команду:
 *
 * 1. По team_id.
 * 2. По точному нормализованному имени.
 * 3. Если имен несколько — уточняет по дивизиону.
 */
function resolveTeam({
  teamId,
  teamName,
  matchDivision,
  ratingsById,
  ratingsByName,
}) {
  const normalizedId =
    normalizeTeamId(teamId);

  if (
    normalizedId &&
    ratingsById.has(normalizedId)
  ) {
    return {
      team: ratingsById.get(normalizedId),
      method: "id",
    };
  }

  const normalizedName =
    normalizeTeamName(teamName);

  if (!normalizedName) {
    return {
      team: null,
      method: "not-found",
    };
  }

  const candidates =
    ratingsByName.get(normalizedName) || [];

  if (candidates.length === 1) {
    return {
      team: candidates[0],
      method: "name",
    };
  }

  if (candidates.length > 1) {
    const sameDivision = candidates.filter(
      (candidate) =>
        candidate.division === matchDivision,
    );

    if (sameDivision.length === 1) {
      return {
        team: sameDivision[0],
        method: "name-and-division",
      };
    }

    return {
      team: null,
      method: "ambiguous",
    };
  }

  /*
   * Команда отсутствует среди нынешних участников.
   * Создаем временную историческую команду,
   * чтобы ее матчи участвовали в расчете.
   */
  const historicalTeam =
    createHistoricalTeamState({
      teamId: normalizedId,
      teamName,
      division: matchDivision,
    });

  ratingsById.set(
    historicalTeam.teamId,
    historicalTeam,
  );

  const nameCandidates =
    ratingsByName.get(normalizedName) || [];

  nameCandidates.push(historicalTeam);

  ratingsByName.set(
    normalizedName,
    nameCandidates,
  );

  return {
    team: historicalTeam,
    method: "historical",
  };
}

async function writeRatings(rows) {
  for (
    let index = 0;
    index < rows.length;
    index += WRITE_BATCH_SIZE
  ) {
    const batch = rows.slice(
      index,
      index + WRITE_BATCH_SIZE,
    );

    const { error } = await supabase
      .from("team_ratings")
      .upsert(batch, {
        onConflict: "team_id",
      });

    if (error) {
      throw new Error(
        `Ошибка записи team_ratings: ${error.message}`,
      );
    }

    console.log(
      `Записано ${Math.min(
        index + batch.length,
        rows.length,
      )}/${rows.length}`,
    );
  }
}

async function main() {
  console.log(
    APPLY_CHANGES
      ? "Режим: ЗАПИСЬ В БАЗУ"
      : "Режим: ПРОВЕРКА БЕЗ ЗАПИСИ",
  );

  console.log("\nЗагружаю команды...");

  const ratingRows = await fetchAllRows({
    table: "team_ratings",
    select: `
      team_id,
      team_name,
      slug,
      division,
      points
    `,
    orderColumn: "team_id",
  });

  console.log(
    `Команд в team_ratings: ${ratingRows.length}`,
  );

  const ratingsById = new Map();

  for (const row of ratingRows) {
    const state =
      createInitialRatingState(row);

    if (state.teamId) {
      ratingsById.set(
        state.teamId,
        state,
      );
    }
  }

  const ratingsByName =
    buildNameIndex(ratingsById);

  const duplicateNames = Array.from(
    ratingsByName.entries(),
  ).filter(
    ([, candidates]) =>
      candidates.length > 1,
  );

  console.log(
    `Неоднозначных названий: ${duplicateNames.length}`,
  );

  console.log(
    "\nЗагружаю завершенные матчи...",
  );

  const matches = await fetchAllRows({
    table: "matches",
    select: `
      id,
      competition_name,
      status,
      best_of,
      scheduled_at,
      finished_at,
      team1_id,
      team1_name,
      team1_score,
      team2_id,
      team2_name,
      team2_score
    `,
    orderColumn: "finished_at",
    ascending: true,
    filters: [
      {
        // worker.js's live-tick writes the FACEIT public API's raw
        // "FINISHED" status, while discovery/autoSync historically wrote
        // the internal API's "MATCH_STATUS_FINISHED" — both mean the
        // same thing. Matching only one variant silently excluded any
        // match finished via the live-tick path from ever affecting
        // ratings.
        type: "in",
        column: "status",
        value: ["FINISHED", "MATCH_STATUS_FINISHED"],
      },
    ],
  });

  matches.sort(
    (first, second) =>
      getMatchTimestamp(first) -
      getMatchTimestamp(second),
  );

  console.log(
    `Завершенных матчей S58 найдено: ${matches.length}`,
  );

  let processed = 0;

  let resolvedTeam1ByName = 0;
  let resolvedTeam2ByName = 0;
  let historicalTeam1Created = 0;
let historicalTeam2Created = 0;

  let skippedPlaceholder = 0;
  let skippedUnknownTeam = 0;
  let skippedAmbiguousTeam = 0;
  let skippedInvalidScore = 0;
  let skippedSameTeam = 0;
  let technicalResultsProcessed = 0;

  const missingNames = new Map();

  for (const match of matches) {
    if (
      isPlaceholderName(match.team1_name) ||
      isPlaceholderName(match.team2_name)
    ) {
      skippedPlaceholder += 1;
      continue;
    }

    const series =
      normalizeSeriesScore(match);

    if (!series) {
      skippedInvalidScore += 1;
      continue;
    }

    const matchDivision =
      getMatchDivision(match);

    const matchRegion =
      getMatchRegion(match);

    const technicalResult =
      isTechnicalResult(match, series);

    const resolvedTeam1 = resolveTeam({
      teamId: match.team1_id,
      teamName: match.team1_name,
      matchDivision,
      ratingsById,
      ratingsByName,
    });

    const resolvedTeam2 = resolveTeam({
      teamId: match.team2_id,
      teamName: match.team2_name,
      matchDivision,
      ratingsById,
      ratingsByName,
    });

    if (
      resolvedTeam1.method === "name" ||
      resolvedTeam1.method ===
        "name-and-division"
    ) {
      resolvedTeam1ByName += 1;
    }

    if (
      resolvedTeam2.method === "name" ||
      resolvedTeam2.method ===
        "name-and-division"
    ) {
      resolvedTeam2ByName += 1;
    }

    if (
      resolvedTeam1.method === "ambiguous" ||
      resolvedTeam2.method === "ambiguous"
    ) {
      skippedAmbiguousTeam += 1;
      continue;
    }

    if (
      !resolvedTeam1.team ||
      !resolvedTeam2.team
    ) {
      skippedUnknownTeam += 1;

      if (!resolvedTeam1.team) {
        const name =
          match.team1_name || "Unknown";

        missingNames.set(
          name,
          (missingNames.get(name) || 0) + 1,
        );
      }

      if (!resolvedTeam2.team) {
        const name =
          match.team2_name || "Unknown";

        missingNames.set(
          name,
          (missingNames.get(name) || 0) + 1,
        );
      }

      continue;
    }

    const team1 = resolvedTeam1.team;
    const team2 = resolvedTeam2.team;

    if (team1.teamId === team2.teamId) {
      skippedSameTeam += 1;
      continue;
    }

    const winner = series.team1Won
      ? team1
      : team2;

    const loser = series.team1Won
      ? team2
      : team1;

    const calculation =
      calculateMatchRating({
        winnerPoints: winner.points,
        loserPoints: loser.points,

        winnerScore:
          series.winnerScore,

        loserScore:
          series.loserScore,

        division:
          matchDivision !== "Unknown"
            ? matchDivision
            : winner.division,

        region: matchRegion,

        /*
         * Техническая победа/поражение дает 60% обычного
         * изменения рейтинга. TBD/BYE/Unknown уже пропускаются.
         */
        resultMultiplier:
          technicalResult ? 0.6 : 1,

        winnerMatchesPlayed:
          winner.matchesPlayed,

        loserMatchesPlayed:
          loser.matchesPlayed,
      });

    winner.previousPoints =
      winner.points;

    winner.points =
      calculation.winnerNewPoints;

    winner.pointsChange =
      calculation.winnerChange;

    winner.matchesPlayed =
      calculation.winnerMatchesPlayed;

    winner.rankingStatus =
      calculation.winnerRankingStatus;

    winner.wins += 1;

    loser.previousPoints =
      loser.points;

    loser.points =
      calculation.loserNewPoints;

    loser.pointsChange =
      calculation.loserChange;

    loser.matchesPlayed =
      calculation.loserMatchesPlayed;

    loser.rankingStatus =
      calculation.loserRankingStatus;

    loser.losses += 1;

    if (technicalResult) {
      technicalResultsProcessed += 1;
    }

    processed += 1;
  }

// previous_points/points_change come straight from the match-replay loop
// above (winner.previousPoints/winner.pointsChange, same for loser): each
// team's own last processed match sets them to "points right before that
// match" / "that match's delta". The replay is a full, deterministic
// re-simulation of the same match history on every run, so these stay
// stable run to run and only move again once the team plays a new match —
// no wall-clock freeze/reset needed.
const nowIso = new Date().toISOString();

const finalRows = Array.from(
  ratingsById.values(),
)
  .filter((team) => team.isCurrentTeam)
  .map((team) => ({
    team_id: team.teamId,
    team_name: team.teamName,
    slug: team.slug || null,
    division: team.division,

    points: team.points,
    previous_points: team.previousPoints,
    points_change: team.pointsChange,

    matches_played: team.matchesPlayed,
    ranking_status: team.rankingStatus,

    updated_at: nowIso,
  }));

  const leaderboard = [...finalRows]
    .sort((first, second) => {
      if (
        second.points !== first.points
      ) {
        return (
          second.points - first.points
        );
      }

      return (
        second.matches_played -
        first.matches_played
      );
    })
    .slice(0, 20);

  const mostMissingNames =
    Array.from(missingNames.entries())
      .sort(
        (first, second) =>
          second[1] - first[1],
      )
      .slice(0, 20);

  console.log("\nРезультат пересчета:");

  console.log(
    `Обработано матчей: ${processed}`,
  );

  console.log(
    `Команда 1 восстановлена по имени: ${resolvedTeam1ByName}`,
  );

  console.log(
    `Команда 2 восстановлена по имени: ${resolvedTeam2ByName}`,
  );

  console.log(
    `Пропущено с TBD/BYE: ${skippedPlaceholder}`,
  );

  console.log(
    `Пропущено из-за отсутствующей команды: ${skippedUnknownTeam}`,
  );

  console.log(
    `Пропущено из-за неоднозначного имени: ${skippedAmbiguousTeam}`,
  );

  console.log(
    `Пропущено из-за некорректного счета: ${skippedInvalidScore}`,
  );

  console.log(
    `Пропущено: обе стороны определились как одна команда: ${skippedSameTeam}`,
  );

  console.log(
    `Обработано технических результатов: ${technicalResultsProcessed}`,
  );

  console.log("\nПредварительный TOP 20:");

  leaderboard.forEach((team, index) => {
    console.log(
      `${String(index + 1).padStart(2, " ")}. ` +
        `${String(team.team_name).padEnd(30, " ")} ` +
        `${String(team.points).padStart(4, " ")} points ` +
        `(${team.matches_played} matches)`,
    );
  });

  if (mostMissingNames.length > 0) {
    console.log(
      "\nЧаще всего не найденные команды:",
    );

    for (
      const [name, count]
      of mostMissingNames
    ) {
      console.log(
        `${String(count).padStart(4, " ")} × ${name}`,
      );
    }
  }

  if (!APPLY_CHANGES) {
    console.log(
      "\nНичего не записано в Supabase.",
    );

    console.log(
      "Сначала проверь результат.",
    );

    console.log(
      "Для записи запусти:",
    );

    console.log(
      "npm run ratings:recalculate -- --apply",
    );

    return;
  }

  console.log(
    "\nЗаписываю итоговый рейтинг в Supabase...",
  );

  await writeRatings(finalRows);

  console.log(
    `\nГотово. Обновлено команд: ${finalRows.length}`,
  );
}

main().catch((error) => {
  console.error(
    "\nОшибка пересчета рейтинга:",
  );

  console.error(error);

  process.exitCode = 1;
});