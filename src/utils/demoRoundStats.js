const counter = value => value && Number.isInteger(value.won) && Number.isInteger(value.total)
  && value.total >= 0 && value.won >= 0 && value.won <= value.total;

export function verifiedTeamRounds(record, teamId, ownScore, otherScore) {
  if (record?.version !== 1 || ![12, 15].includes(record.halfLength) || !Array.isArray(record.teams) || record.teams.length !== 2) return null;
  const own = record.teams.find(team => team.id === teamId), other = record.teams.find(team => team.id !== teamId);
  if (!own || !other || own.score !== ownScore || other.score !== otherScore || Math.max(ownScore, otherScore) < 13) return null;
  const total = ownScore + otherScore;
  for (const team of [own, other]) {
    if (![team.ct, team.t, team.overtime, team.pistol, team.pistol?.ct, team.pistol?.t, team.halves].every(counter)
      || team.ct.total + team.t.total !== total || team.ct.won + team.t.won !== team.score
      || team.overtime.total !== Math.max(0, total - record.halfLength * 2)
      || team.pistol.total !== 2 || team.pistol.ct.total !== 1 || team.pistol.t.total !== 1
      || team.pistol.won !== team.pistol.ct.won + team.pistol.t.won
      || team.halves.total !== 2 || !Number.isInteger(team.halves.draws) || team.halves.draws < 0 || team.halves.draws + team.halves.won > 2) return null;
  }
  if (own.ct.total !== other.t.total || own.t.total !== other.ct.total
    || own.ct.won + other.t.won !== own.ct.total || own.t.won + other.ct.won !== own.t.total
    || own.pistol.won + other.pistol.won !== 2 || own.overtime.won + other.overtime.won !== own.overtime.total) return null;
  return own;
}

export function aggregateDemoRounds(matches) {
  const covered = matches.filter(match => match.roundStats);
  const sum = key => covered.reduce((total, match) => { const value = key.split('.').reduce((v, k) => v[k], match.roundStats); return total + value; }, 0);
  const metric = key => { const won = sum(`${key}.won`), total = sum(`${key}.total`); return { won, total, rate: total ? Math.round(won / total * 1000) / 10 : null }; };
  return { covered: covered.length, eligible: matches.length, ct: metric('ct'), t: metric('t'), overtime: metric('overtime'),
    pistol: metric('pistol'), ctPistol: metric('pistol.ct'), tPistol: metric('pistol.t'), halves: { ...metric('halves'), draws: sum('halves.draws') } };
}
