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

function parseBoScore(boScore) {
  const [teamScore, opponentScore] = String(boScore)
    .split(":")
    .map((part) => Number(part.trim()));

  return {
    teamScore: Number.isFinite(teamScore) ? teamScore : 0,
    opponentScore: Number.isFinite(opponentScore) ? opponentScore : 0,
  };
}

// One row per map (HLTV-style), newest series first. Falls back to a
// single series-level row when map scores aren't synced yet.
export function buildHeadToHeadMapRows(matches, leftTeamSlug) {
  const sortedMatches = [...matches].sort((a, b) =>
    String(b.date).localeCompare(String(a.date))
  );

  const rows = [];

  sortedMatches.forEach((item, seriesIndex) => {
    const itemIsLeftTeam = item.teamSlug === leftTeamSlug;
    const maps = Array.isArray(item.mapScores) ? item.mapScores : [];

    const mapEntries =
      maps.length > 0
        ? maps.map((map) => ({
            mapName: map.map,
            teamScore: Number(map.teamScore) || 0,
            opponentScore: Number(map.opponentScore) || 0,
            teamWon: Boolean(map.won),
          }))
        : (() => {
            const { teamScore, opponentScore } = parseBoScore(
              item.boScore
            );

            return [
              {
                mapName: null,
                teamScore,
                opponentScore,
                teamWon: teamScore > opponentScore,
              },
            ];
          })();

    mapEntries.forEach((entry, index) => {
      const leftScore = itemIsLeftTeam
        ? entry.teamScore
        : entry.opponentScore;

      const rightScore = itemIsLeftTeam
        ? entry.opponentScore
        : entry.teamScore;

      rows.push({
        key: `${item.matchId}-${index}`,
        matchId: item.matchId,
        date: item.date,
        mapName: entry.mapName,
        leftWon: itemIsLeftTeam
          ? entry.teamWon
          : !entry.teamWon,
        leftScore,
        rightScore,
        overtime: Math.min(leftScore, rightScore) >= 13,
        stripe: seriesIndex % 2 === 1,
      });
    });
  });

  return rows;
}
