import fs from "fs";

const source = JSON.parse(
  fs.readFileSync(
    "./src/data/matchStatsV3.json",
    "utf8"
  )
);

const compact = {};

for (const [matchId, matchData] of Object.entries(source)) {
  const match = matchData?.[0];

  if (!match) continue;

  compact[matchId] = {
    matchId,
    map: match.map,
    teams: (match.teams || []).map(team => ({
      teamId: team.teamId,
      teamName: team.teamName,
      score: team.score,

      players: (team.players || []).map(player => ({
        playerId: player.playerId,
        nickname: player.nickname,

        kills: player.kills,
        deaths: player.deaths,
        assists: player.assists,

        adr: player.adr,
        kd: player.kd,
        hsRate: player.hsRate,

        kast: player.kast,
        mvps: player.mvps
      }))
    }))
  };
}

fs.writeFileSync(
  "./src/data/matchStatsCompact.json",
  JSON.stringify(compact)
);

console.log(
  "Saved:",
  Object.keys(compact).length,
  "matches"
);