export function calculatePlayerMatchRating(player) {
  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  const kd = player.kd || 0;
  const adr = player.adr || 0;
  const assists = player.assists || 0;
  const mvps = player.mvps || 0;

  const entryDiff = player.entryDiff || 0;
  const clutchWins = player.clutchRoundsWon || 0;

  const twoKs = player["2k"] || 0;
  const threeKs = player["3k"] || 0;
  const fourKs = player["4k"] || 0;
  const aces = player.aces || 0;

  // Основные показатели

  const kdScore =
    clamp(kd, 0.4, 1.8);

  const adrScore =
    clamp(adr / 75, 0.4, 1.8);

  const assistScore =
    clamp(assists / 10, 0, 1.5);

  const mvpScore =
    clamp(mvps / 5, 0, 1.5);

  // Бонусы за импакт

  const entryBonus =
    clamp(entryDiff / 20, -0.15, 0.15);

  const clutchBonus =
    clamp(clutchWins / 10, 0, 0.10);

  const impactBonus =
    clamp(
      (
        twoKs +
        threeKs * 2 +
        fourKs * 3 +
        aces * 5
      ) / 100,
      0,
      0.10
    );

  const rating =
    kdScore * 0.45 +
    adrScore * 0.35 +
    assistScore * 0.05 +
    mvpScore * 0.05 +
    entryBonus +
    clutchBonus +
    impactBonus;

  // Подгоняем шкалу ближе к Faceit

  return Number((rating * 1.12).toFixed(2));
}