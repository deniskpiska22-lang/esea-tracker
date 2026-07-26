// HLTV-style H2H: every map counts as a point, so a BO3 win (2:1)
// contributes 2 points to the winner and 1 to the loser, not a flat 1-0.
export function countHeadToHeadMapWins(matches, leftTeamSlug) {
  let leftWins = 0;
  let rightWins = 0;

  matches.forEach((item) => {
    const itemIsLeftTeam = item.teamSlug === leftTeamSlug;
    const maps = Array.isArray(item.mapScores)
      ? item.mapScores
      : [];

    if (maps.length > 0) {
      maps.forEach((map) => {
        if (itemIsLeftTeam === Boolean(map.won)) {
          leftWins += 1;
        } else {
          rightWins += 1;
        }
      });
      return;
    }

    // Map scores aren't synced yet — fall back to the series result
    // so the match still counts for something.
    const [teamScore, opponentScore] = String(item.boScore)
      .split(":")
      .map(Number);

    if (itemIsLeftTeam === teamScore > opponentScore) {
      leftWins += 1;
    } else {
      rightWins += 1;
    }
  });

  return { leftWins, rightWins };
}
