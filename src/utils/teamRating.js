/**
 * teamRating.js
 *
 * Готовая рейтинговая система для ESEA Tracker.
 * Шкала рейтинга: 0–1000 points.
 *
 * Логика:
 * - стартовые points зависят от дивизиона;
 * - команда считается Unranked до 3 сыгранных матчей;
 * - первые 5 матчей проходят с ускоренной калибровкой;
 * - учитывается сила соперника;
 * - учитывается счет серии;
 * - максимальный рейтинг ограничен 1000;
 * - минимальный рейтинг ограничен 0.
 */

/* Стартовые points по дивизионам */
export const INITIAL_POINTS_BY_DIVISION = Object.freeze({
  Advanced: 550,
  Main: 400,
  Intermediate: 275,
  Entry: 175,

  Open10: 130,
  Open9: 115,
  "Open5-8": 100,
  "Open1-4": 85,
  Open: 85,

  Unknown: 85,
});

/*
 * Скорость изменения рейтинга.
 * Более высокий дивизион сильнее влияет на общий рейтинг.
 */
export const K_FACTOR_BY_DIVISION = Object.freeze({
  Advanced: 26,
  Main: 22,
  Intermediate: 18,
  Entry: 14,

  Open10: 12,
  Open9: 11,
  "Open5-8": 10,
  "Open1-4": 9,
  Open: 9,

  Unknown: 10,
});


/*
 * Множители силы региона.
 *
 * Они влияют только на изменение рейтинга за матч.
 * Стартовые очки команды остаются зависящими от дивизиона.
 */
export const REGION_MULTIPLIER_BY_REGION = Object.freeze({
  EU: 1.15,
  NA: 1.0,
  SA: 0.95,
  ASIA: 0.88,
  OCEANIA: 0.83,
  AFRICA: 0.8,

  Unknown: 1.0,
});

export const RATING_CONFIG = Object.freeze({
  minimumPoints: 0,
  maximumPoints: 1000,

  /* До этого количества матчей команда не показывается в публичном рейтинге */
  rankedAfterMatches: 3,

  /* Первые матчи быстрее определяют реальную силу новой команды */
  provisionalMatches: 5,
  provisionalMultiplier: 1.35,

  /* Максимальное изменение за один матч */
  maximumSingleMatchChange: 40,

  /*
   * Масштаб Elo.
   * Для шкалы 0–1000 значение 200 дает достаточно заметную разницу
   * между командами разных дивизионов.
   */
  ratingScale: 200,
});

/**
 * Приводит названия дивизионов FACEIT к единому формату.
 */
export function normalizeDivisionName(division) {
  const value = String(division ?? "").trim().toLowerCase();

  if (value.includes("advanced")) return "Advanced";

  if (
    value === "main" ||
    value.endsWith(" main") ||
    value.startsWith("main ")
  ) {
    return "Main";
  }

  if (value.includes("intermediate")) return "Intermediate";
  if (value.includes("entry")) return "Entry";

  if (
    value.includes("open10") ||
    value.includes("open 10") ||
    value.includes("open division 10")
  ) {
    return "Open10";
  }

  if (
    value.includes("open9") ||
    value.includes("open 9") ||
    value.includes("open division 9")
  ) {
    return "Open9";
  }

  if (
    value.includes("open5-8") ||
    value.includes("open 5-8") ||
    value.includes("open divisions 5-8")
  ) {
    return "Open5-8";
  }

  if (
    value.includes("open1-4") ||
    value.includes("open 1-4") ||
    value.includes("open divisions 1-4")
  ) {
    return "Open1-4";
  }

  if (value.includes("open")) return "Open";

  return "Unknown";
}


/**
 * Приводит регион или название соревнования к единому формату.
 *
 * Примеры:
 * S58 EU Main A - Regular Season -> EU
 * S58 NA Advanced -> NA
 * S58 Asia Entry -> ASIA
 */
export function normalizeRegionName(regionOrCompetitionName) {
  const value = String(regionOrCompetitionName ?? "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (/\bEU\b/.test(value) || /\bEUROPE\b/.test(value)) {
    return "EU";
  }

  if (
    /\bNA\b/.test(value) ||
    /\bNORTH AMERICA\b/.test(value)
  ) {
    return "NA";
  }

  if (
    /\bSA\b/.test(value) ||
    /\bSOUTH AMERICA\b/.test(value) ||
    /\bLATAM\b/.test(value)
  ) {
    return "SA";
  }

  if (
    /\bASIA\b/.test(value) ||
    /\bAPAC\b/.test(value)
  ) {
    return "ASIA";
  }

  if (
    /\bOCE\b/.test(value) ||
    /\bOCEANIA\b/.test(value) ||
    /\bAUSTRALIA\b/.test(value)
  ) {
    return "OCEANIA";
  }

  if (
    /\bAFRICA\b/.test(value) ||
    /\bAFR\b/.test(value)
  ) {
    return "AFRICA";
  }

  return "Unknown";
}

/**
 * Возвращает множитель силы региона.
 */
export function getRegionMultiplier(regionOrCompetitionName) {
  const normalizedRegion = normalizeRegionName(
    regionOrCompetitionName,
  );

  return (
    REGION_MULTIPLIER_BY_REGION[normalizedRegion] ??
    REGION_MULTIPLIER_BY_REGION.Unknown
  );
}


/**
 * Возвращает стартовое количество points для команды.
 */
export function getInitialPoints(division) {
  const normalized = normalizeDivisionName(division);

  return (
    INITIAL_POINTS_BY_DIVISION[normalized] ??
    INITIAL_POINTS_BY_DIVISION.Unknown
  );
}

/**
 * Возвращает K-фактор дивизиона.
 */
export function getDivisionKFactor(division) {
  const normalized = normalizeDivisionName(division);

  return (
    K_FACTOR_BY_DIVISION[normalized] ??
    K_FACTOR_BY_DIVISION.Unknown
  );
}

/**
 * Вероятность победы команды A против команды B.
 */
export function getExpectedScore(
  pointsA,
  pointsB,
  ratingScale = RATING_CONFIG.ratingScale,
) {
  const a = Number(pointsA);
  const b = Number(pointsB);

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error("Points обеих команд должны быть числами.");
  }

  return 1 / (1 + 10 ** ((b - a) / ratingScale));
}

/**
 * Множитель по счету серии.
 *
 * BO1:
 * 1:0 = 1.00
 *
 * BO3:
 * 2:1 = 1.00
 * 2:0 = 1.20
 *
 * BO5:
 * 3:2 = 1.00
 * 3:1 = 1.15
 * 3:0 = 1.30
 */
export function getSeriesScoreMultiplier(winnerScore, loserScore) {
  const win = Number(winnerScore);
  const loss = Number(loserScore);

  if (
    !Number.isFinite(win) ||
    !Number.isFinite(loss) ||
    win <= loss ||
    loss < 0
  ) {
    throw new Error(`Некорректный счет серии: ${winnerScore}:${loserScore}`);
  }

  if (win === 1 && loss === 0) return 1.0;

  if (win === 2 && loss === 1) return 1.0;
  if (win === 2 && loss === 0) return 1.2;

  if (win === 3 && loss === 2) return 1.0;
  if (win === 3 && loss === 1) return 1.15;
  if (win === 3 && loss === 0) return 1.3;

  const mapsPlayed = win + loss;
  const dominance = (win - loss) / Math.max(1, mapsPlayed);

  return Math.min(1.3, 1 + dominance * 0.3);
}

/**
 * Возвращает статус команды для публичного рейтинга.
 */
export function getRankingStatus(
  matchesPlayed,
  rankedAfterMatches = RATING_CONFIG.rankedAfterMatches,
) {
  return Number(matchesPlayed ?? 0) >= rankedAfterMatches
    ? "ranked"
    : "unranked";
}

/**
 * Проверяет, можно ли показывать команду в публичном рейтинге.
 */
export function isTeamRanked(
  team,
  rankedAfterMatches = RATING_CONFIG.rankedAfterMatches,
) {
  return getRankingStatus(
    team?.rating_matches_played ?? team?.matchesPlayed ?? 0,
    rankedAfterMatches,
  ) === "ranked";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getProvisionalMultiplier(matchesPlayed, config) {
  return Number(matchesPlayed ?? 0) < config.provisionalMatches
    ? config.provisionalMultiplier
    : 1;
}

/**
 * Основная формула расчета рейтинга после матча.
 *
 * @param {Object} input
 * @param {number} input.winnerPoints
 * @param {number} input.loserPoints
 * @param {number} input.winnerScore
 * @param {number} input.loserScore
 * @param {string} input.division
 * @param {number} [input.winnerMatchesPlayed=0]
 * @param {number} [input.loserMatchesPlayed=0]
 * @param {Object} [input.config]
 */
export function calculateMatchRating({
  winnerPoints,
  loserPoints,
  winnerScore,
  loserScore,
  division,
  region = "Unknown",
  resultMultiplier = 1,
  winnerMatchesPlayed = 0,
  loserMatchesPlayed = 0,
  config = {},
}) {
  const settings = {
    ...RATING_CONFIG,
    ...config,
  };

  const currentWinnerPoints = Number(winnerPoints);
  const currentLoserPoints = Number(loserPoints);

  if (
    !Number.isFinite(currentWinnerPoints) ||
    !Number.isFinite(currentLoserPoints)
  ) {
    throw new Error("Points победителя и проигравшего должны быть числами.");
  }

  const normalizedDivision = normalizeDivisionName(division);
  const kFactor = getDivisionKFactor(normalizedDivision);

  const normalizedRegion = normalizeRegionName(region);
  const regionMultiplier = getRegionMultiplier(normalizedRegion);

  const normalizedResultMultiplier = clamp(
    Number(resultMultiplier) || 1,
    0,
    1,
  );

  const winnerExpected = getExpectedScore(
    currentWinnerPoints,
    currentLoserPoints,
    settings.ratingScale,
  );

  const loserExpected = 1 - winnerExpected;

  const scoreMultiplier = getSeriesScoreMultiplier(
    winnerScore,
    loserScore,
  );

  const winnerProvisionalMultiplier = getProvisionalMultiplier(
    winnerMatchesPlayed,
    settings,
  );

  const loserProvisionalMultiplier = getProvisionalMultiplier(
    loserMatchesPlayed,
    settings,
  );

  /*
   * Победитель:
   * фактический результат = 1
   *
   * Проигравший:
   * фактический результат = 0
   */
  const rawWinnerChange =
    kFactor *
    regionMultiplier *
    normalizedResultMultiplier *
    scoreMultiplier *
    winnerProvisionalMultiplier *
    (1 - winnerExpected);

  const rawLoserChange =
    kFactor *
    regionMultiplier *
    normalizedResultMultiplier *
    scoreMultiplier *
    loserProvisionalMultiplier *
    loserExpected;

  const winnerChange = Math.round(
    clamp(
      rawWinnerChange,
      1,
      settings.maximumSingleMatchChange,
    ),
  );

  const loserChange = -Math.round(
    clamp(
      rawLoserChange,
      1,
      settings.maximumSingleMatchChange,
    ),
  );

  const winnerNewPoints = clamp(
    currentWinnerPoints + winnerChange,
    settings.minimumPoints,
    settings.maximumPoints,
  );

  const loserNewPoints = clamp(
    currentLoserPoints + loserChange,
    settings.minimumPoints,
    settings.maximumPoints,
  );

  const nextWinnerMatchesPlayed =
    Number(winnerMatchesPlayed ?? 0) + 1;

  const nextLoserMatchesPlayed =
    Number(loserMatchesPlayed ?? 0) + 1;

  return {
    winnerChange,
    loserChange,

    winnerNewPoints,
    loserNewPoints,

    winnerPreviousPoints: currentWinnerPoints,
    loserPreviousPoints: currentLoserPoints,

    winnerExpected: Number(winnerExpected.toFixed(4)),
    loserExpected: Number(loserExpected.toFixed(4)),

    scoreMultiplier,
    regionMultiplier,
    resultMultiplier: normalizedResultMultiplier,

    kFactor,
    division: normalizedDivision,
    region: normalizedRegion,

    winnerMatchesPlayed: nextWinnerMatchesPlayed,
    loserMatchesPlayed: nextLoserMatchesPlayed,

    winnerRankingStatus: getRankingStatus(
      nextWinnerMatchesPlayed,
      settings.rankedAfterMatches,
    ),

    loserRankingStatus: getRankingStatus(
      nextLoserMatchesPlayed,
      settings.rankedAfterMatches,
    ),
  };
}

/**
 * Применяет матч сразу к объектам двух команд.
 *
 * Поддерживает как поле points, так и старое поле rating.
 */
export function applyMatchToTeams({
  winner,
  loser,
  winnerScore,
  loserScore,
  division,
  region = "Unknown",
  resultMultiplier = 1,
  config,
}) {
  if (!winner || !loser) {
    throw new Error("Не переданы winner и loser.");
  }

  const winnerPoints =
    Number(winner.points ?? winner.rating) ||
    getInitialPoints(winner.division ?? division);

  const loserPoints =
    Number(loser.points ?? loser.rating) ||
    getInitialPoints(loser.division ?? division);

  const winnerMatchesPlayed = Number(
    winner.rating_matches_played ??
    winner.matchesPlayed ??
    0,
  );

  const loserMatchesPlayed = Number(
    loser.rating_matches_played ??
    loser.matchesPlayed ??
    0,
  );

  const calculation = calculateMatchRating({
    winnerPoints,
    loserPoints,
    winnerScore,
    loserScore,
    division,
    region,
    resultMultiplier,
    winnerMatchesPlayed,
    loserMatchesPlayed,
    config,
  });

  return {
    winner: {
      ...winner,

      previous_points: winnerPoints,
      points: calculation.winnerNewPoints,

      /* Оставлено для совместимости со старым сайтом */
      previous_rating: winnerPoints,
      rating: calculation.winnerNewPoints,

      rating_change: calculation.winnerChange,
      points_change: calculation.winnerChange,

      rating_matches_played:
        calculation.winnerMatchesPlayed,

      ranking_status:
        calculation.winnerRankingStatus,
    },

    loser: {
      ...loser,

      previous_points: loserPoints,
      points: calculation.loserNewPoints,

      /* Оставлено для совместимости со старым сайтом */
      previous_rating: loserPoints,
      rating: calculation.loserNewPoints,

      rating_change: calculation.loserChange,
      points_change: calculation.loserChange,

      rating_matches_played:
        calculation.loserMatchesPlayed,

      ranking_status:
        calculation.loserRankingStatus,
    },

    calculation,
  };
}

/**
 * Инициализирует новую команду.
 */
export function createInitialTeamRating(team) {
  const division = normalizeDivisionName(team?.division);
  const points = getInitialPoints(division);

  return {
    ...team,

    division,

    previous_points: points,
    points,

    /* Совместимость со старым кодом */
    previous_rating: points,
    rating: points,

    rating_change: 0,
    points_change: 0,

    rating_matches_played: 0,
    ranking_status: "unranked",
  };
}

/**
 * Сортирует только команды, допущенные в публичный рейтинг.
 */
export function buildPublicRanking(
  teams,
  rankedAfterMatches = RATING_CONFIG.rankedAfterMatches,
) {
  if (!Array.isArray(teams)) return [];

  return teams
    .filter((team) => isTeamRanked(team, rankedAfterMatches))
    .sort((a, b) => {
      const pointsA = Number(a.points ?? a.rating ?? 0);
      const pointsB = Number(b.points ?? b.rating ?? 0);

      if (pointsB !== pointsA) {
        return pointsB - pointsA;
      }

      const matchesA = Number(
        a.rating_matches_played ?? a.matchesPlayed ?? 0,
      );

      const matchesB = Number(
        b.rating_matches_played ?? b.matchesPlayed ?? 0,
      );

      return matchesB - matchesA;
    })
    .map((team, index) => ({
      ...team,
      rank: index + 1,
    }));
}

/*
 * Пример использования:
 *
 * const teamA = createInitialTeamRating({
 *   id: "team-a",
 *   name: "Team A",
 *   division: "Entry",
 * });
 *
 * const teamB = createInitialTeamRating({
 *   id: "team-b",
 *   name: "Team B",
 *   division: "Entry",
 * });
 *
 * const result = applyMatchToTeams({
 *   winner: teamA,
 *   loser: teamB,
 *   winnerScore: 2,
 *   loserScore: 0,
 *   division: "Entry",
 * });
 *
 * console.log(result.winner.points);
 * console.log(result.loser.points);
 * console.log(result.calculation);
 */
