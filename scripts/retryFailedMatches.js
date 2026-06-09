import fs from "fs";

const stats = JSON.parse(
  fs.readFileSync(
    "./src/data/matchStats.json",
    "utf8"
  )
);

const failedIds = Object.entries(stats)
  .filter(
    ([_, value]) =>
      value?.failed === true
  )
  .map(([matchId]) => matchId);

console.log(
  "Failed matches:",
  failedIds.length
);

fs.writeFileSync(
  "./failedMatches.json",
  JSON.stringify(failedIds, null, 2)
);