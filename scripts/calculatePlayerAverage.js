import fs from "fs";
import { calculatePlayerMatchRating } from "../src/utils/calculatePlayerRating.js";
import { normalizeNickname } from "../src/utils/normalizeNickname.js";

const matchStats = JSON.parse(
  fs.readFileSync("./src/data/matchStatsCompact.json", "utf8")
);

const playerRatings = {};

for (const match of Object.values(matchStats)) {

  for (const team of match.teams || []) {

    for (const player of team.players || []) {

      const nickname = normalizeNickname(player.nickname);

      const rating =
        calculatePlayerMatchRating(player);

      if (!playerRatings[nickname]) {
        playerRatings[nickname] = [];
      }

      playerRatings[nickname].push(rating);

    }

  }

}

const playerAverageRatings = {};

for (const [nickname, ratings] of Object.entries(playerRatings)) {

  const average =
    ratings.reduce((a, b) => a + b, 0) /
    ratings.length;

  playerAverageRatings[nickname] =
    Number(average.toFixed(2));

}

fs.writeFileSync(
  "./src/data/playerAverageRatings.json",
  JSON.stringify(playerAverageRatings, null, 2),
  "utf8"
);

console.log(
  `✅ Calculated ratings for ${Object.keys(playerAverageRatings).length} players`
);