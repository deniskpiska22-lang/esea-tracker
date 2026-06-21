import fs from "fs";

const matchStats = JSON.parse(
  fs.readFileSync(
    "./src/data/matchStats.json",
    "utf8"
  )
);

const retryResults = JSON.parse(
  fs.readFileSync(
    "./retryResults.json",
    "utf8"
  )
);

let replaced = 0;

for (const [matchId, payload] of Object.entries(
  retryResults
)) {
  matchStats[matchId] = payload;
  replaced++;
}

fs.writeFileSync(
  "./src/data/matchStats.json",
  JSON.stringify(matchStats, null, 2)
);

console.log(
  `Merged ${replaced} matches`
);