import fs from "fs";
import matches from "../src/data/matches.js";

const updatedMatches = matches.map((match, index) => ({
  ...match,
  localMatchId: index + 1,
}));

const fileContent =
  `const matches = ${JSON.stringify(updatedMatches, null, 2)};\n\nexport default matches;\n`;

fs.writeFileSync(
  "./src/data/matches.js",
  fileContent,
  "utf8"
);

console.log(
  `✅ Added localMatchId to ${updatedMatches.length} matches`
);