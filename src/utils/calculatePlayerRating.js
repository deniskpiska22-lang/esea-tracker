export function calculatePlayerMatchRating(player = {}) {
  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  const number = (...values) => {
    for (const value of values) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  };

  const kills = number(
    player.kills,
    player.Kills
  );

  const deaths = number(
    player.deaths,
    player.Deaths
  );

  const kd = number(
    player.kd,
    player["K/D Ratio"],
    player["K/D"],
    deaths > 0
      ? kills / deaths
      : kills
  );

  const adr = number(
    player.adr,
    player.ADR,
    player["Average Damage per Round"]
  );

  const assists = number(
    player.assists,
    player.Assists
  );

  const mvps = number(
    player.mvps,
    player.MVPs,
    player.MVP
  );

  const entryDiff = number(
    player.entryDiff,
    player.entry_diff,
    player["Entry Diff"],
    player["Entry difference"]
  );

  const clutchWins = number(
    player.clutchRoundsWon,
    player.clutch_rounds_won,
    player["Clutch Rounds Won"],
    player.clutches
  );

  const twoKs = number(
    player["2k"],
    player.twoKs,
    player.doubleKills
  );

  const threeKs = number(
    player["3k"],
    player.threeKs,
    player.tripleKills
  );

  const fourKs = number(
    player["4k"],
    player.fourKs,
    player.quadroKills
  );

  const aces = number(
    player.aces,
    player["5k"],
    player.pentaKills
  );

  const kdScore =
    clamp(kd, 0.4, 1.8);

  const adrScore =
    clamp(adr / 75, 0.4, 1.8);

  const assistScore =
    clamp(assists / 10, 0, 1.5);

  const mvpScore =
    clamp(mvps / 5, 0, 1.5);

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

  return Number(
    (rating * 1.12).toFixed(2)
  );
}
