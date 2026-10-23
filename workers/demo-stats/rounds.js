// Reconstruct only the final, score-verified timeline. Restarts/round restores
// may repeat round numbers; knife, warmup and surrender awards are never stats.
const playedReasons = new Set([1, 7, 8, 9, 12]);
const emptyTeam = id => ({ id, score: 0, ct: { won: 0, total: 0 }, t: { won: 0, total: 0 }, overtime: { won: 0, total: 0 },
  pistol: { won: 0, total: 0, ct: { won: 0, total: 0 }, t: { won: 0, total: 0 } }, halves: { won: 0, draws: 0, total: 0 } });

export function reconstructRounds(snapshots, expected) {
  const { team1, team2 } = expected;
  if (!team1?.id || !team2?.id || team1.id === team2.id || ![team1.score, team2.score].every(Number.isInteger)
    || Math.min(team1.score, team2.score) < 0 || Math.max(team1.score, team2.score) < 13 || team1.score + team2.score > 200) throw new Error('Unverified map result');
  const ordered = snapshots.filter(s => !s.warmup && playedReasons.has(s.reason) && [2, 3].includes(s.winner)
    && [2, 3].includes(s.side1) && s.side2 === 5 - s.side1 && Number.isInteger(s.tick)).sort((a, b) => b.tick - a.tick);
  let a = team1.score, b = team2.score, before = Infinity;
  const rounds = [];
  while (a + b > 0) {
    const round = ordered.find(s => s.tick < before && s.round === a + b - 1 && s.score1 === a && s.score2 === b);
    if (!round) throw new Error('Incomplete or inconsistent demo timeline');
    const ownWin = round.winner === round.side1;
    if ((ownWin ? a : b) <= 0) throw new Error('Invalid round winner');
    rounds.unshift(round);
    if (ownWin) a--; else b--;
    before = round.tick;
  }
  const halfLength = rounds.findIndex(s => s.side1 !== rounds[0].side1);
  if (![12, 15].includes(halfLength)) throw new Error('Unverified regulation half length');
  // Regulation determines the two pistol rounds. Overtime sides are read from
  // actual rosters, never inferred from an assumed first overtime side.
  if (rounds.some((round, index) => {
    if (index >= 2 * halfLength) return false;
    return round.side1 !== (index < halfLength ? rounds[0].side1 : 5 - rounds[0].side1);
  })) throw new Error('Unexpected side changes');
  const teams = [emptyTeam(team1.id), emptyTeam(team2.id)];
  rounds.forEach((round, index) => teams.forEach((team, i) => {
    const side = i === 0 ? round.side1 : round.side2, won = Number(side === round.winner), key = side === 3 ? 'ct' : 't';
    team.score += won;
    team[key].won += won; team[key].total++;
    if (index >= halfLength * 2) { team.overtime.won += won; team.overtime.total++; }
    if (index === 0 || index === halfLength) {
      team.pistol.won += won; team.pistol.total++;
      team.pistol[key].won += won; team.pistol[key].total++;
    }
  }));
  for (const start of [0, halfLength]) {
    const half = rounds.slice(start, start + halfLength);
    if (!half.length) continue;
    teams.forEach((team, i) => {
      const wins = half.filter(r => r.winner === (i === 0 ? r.side1 : r.side2)).length;
      team.halves.total++;
      team.halves.won += Number(wins > half.length / 2);
      team.halves.draws += Number(wins === half.length / 2);
    });
  }
  return { version: 1, halfLength, teams };
}

export function sideForRoster(players, steamIds) {
  const ids = new Set(steamIds);
  const votes = [2, 3].map(side => new Set(players.filter(p => ids.has(String(p.steamid)) && p.team_num === side).map(p => String(p.steamid))).size);
  return votes[0] >= 3 && votes[1] === 0 ? 2 : votes[1] >= 3 && votes[0] === 0 ? 3 : null;
}
