import fs from "fs";

const matchStats = JSON.parse(
  fs.readFileSync(
    "./src/data/matchStatsCompact.json",
    "utf8"
  )
);

const nicknames = new Set();

for (const match of Object.values(matchStats)) {
  for (const team of match.teams || []) {
    for (const player of team.players || []) {
      nicknames.add(player.nickname);
    }
  }
}

console.log([...nicknames].sort());