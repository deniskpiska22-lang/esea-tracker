// Connect only known 2→1 / 1→1 progression. Lower brackets may use other
// round sizes; no speculative links are drawn for those transitions.
export function bracketLayout(rounds, slot = 128) {
  const list = (Array.isArray(rounds) ? rounds : []).filter(
    (round) => Array.isArray(round.matches) && round.matches.length,
  );
  const height = Math.max(
    152,
    ...list.map((round) => round.matches.length * slot),
  );
  return list.map((round, index) => {
    const count = round.matches.length;
    const centers = round.matches.map((_, i) => ((i + 0.5) * height) / count);
    const nextCount = list[index + 1]?.matches.length || 0;
    const edges =
      nextCount && (count === nextCount * 2 || count === nextCount)
        ? centers.map((y, i) => ({
            from: y,
            to:
              ((Math.floor(i / (count / nextCount)) + 0.5) * height) /
              nextCount,
          }))
        : [];
    return { round, height, centers, edges };
  });
}
export function bracketWinner(match) {
  if (match?.winner === 1 || match?.winner === 2) return match.winner;
  // A score alone can be live, so never infer a winner from an unfinished map.
  return null;
}
