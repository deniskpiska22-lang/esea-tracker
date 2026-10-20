function sameTeam(a, b) {
  const idA = a?.id || a?.teamId || a?.faceitTeamId;
  const idB = b?.id || b?.teamId || b?.faceitTeamId;
  if (idA && idB) return idA === idB;
  const name = (value) =>
    String(value?.name || "")
      .normalize("NFKC")
      .trim()
      .toLowerCase();
  const first = name(a),
    second = name(b);
  return !!first && !["bye", "tbd", "?"].includes(first) && first === second;
}
export function bracketWinner(match) {
  if (match?.winner === 1 || match?.winner === 2) return match.winner;
  // A score alone can be live, so never infer a winner from a lead.
  return null;
}
function advancingTeams(match) {
  const winner = bracketWinner(match);
  return winner ? [match[`team${winner}`]] : [match.team1, match.team2];
}
function feedsInto(source, target) {
  return advancingTeams(source).some(
    (team) => sameTeam(team, target.team1) || sameTeam(team, target.team2),
  );
}
export function bracketLayout(rounds, slot = 128) {
  const list = (Array.isArray(rounds) ? rounds : [])
    .filter((round) => Array.isArray(round.matches) && round.matches.length)
    .map((round) => ({ ...round, matches: [...round.matches] }));
  // FACEIT can put bye matches after played matches. Reorder backwards from
  // the final using actual advancing teams, never adjacent array positions.
  for (let i = list.length - 2; i >= 0; i--) {
    const remaining = new Set(list[i].matches);
    const ordered = [];
    for (const target of list[i + 1].matches)
      for (const team of [target.team1, target.team2]) {
        const candidates = [...remaining].filter((source) =>
          advancingTeams(source).some((candidate) => sameTeam(candidate, team)),
        );
        if (candidates.length === 1) {
          ordered.push(candidates[0]);
          remaining.delete(candidates[0]);
        }
      }
    list[i].matches = [...ordered, ...remaining];
  }
  const height = Math.max(
    152,
    ...list.map((round) => round.matches.length * slot),
  );
  return list.map((round, index) => {
    const centers = round.matches.map(
      (_, i) => ((i + 0.5) * height) / round.matches.length,
    );
    const next = list[index + 1]?.matches || [];
    const edges = round.matches.flatMap((match, i) => {
      const targets = next
        .map((target, j) => (feedsInto(match, target) ? j : -1))
        .filter((j) => j >= 0);
      // Missing or ambiguous identity must not create a misleading connection.
      return targets.length === 1
        ? [
            {
              from: centers[i],
              to: ((targets[0] + 0.5) * height) / next.length,
            },
          ]
        : [];
    });
    return { round, height, centers, edges };
  });
}
