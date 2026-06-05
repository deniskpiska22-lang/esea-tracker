
import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";

const teams = (await import("../src/data/teams.js")).default;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getTeamMatches(nickname) {
  try {
    let page = 1;
    const allMatches = [];

    while (page <= 20) {
      const url =
        page === 1
          ? `https://faceitanalyser.com/matches/${encodeURIComponent(
              nickname
            )}/cs2`
          : `https://faceitanalyser.com/matches/${encodeURIComponent(
              nickname
            )}/cs2?page=${page}`;

      console.log(`   Page ${page}`);

      const { data: html } = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      const $ = cheerio.load(html);

      const rows = $("tr.maps_tr");

      if (rows.length === 0) {
        break;
      }

      rows.each((_, row) => {
        const season = $(row)
          .find(".hub-cell a")
          .last()
          .text()
          .trim();

        if (!season.includes("S57")) return;

        const date = $(row)
          .find(".col-date")
          .text()
          .trim();

        const score = $(row)
          .find(".col-score")
          .text()
          .trim()
          .replace(/\s+/g, " ");

        const matchLink = $(row)
          .find(".col-match a")
          .attr("href");

        let matchId = null;

        if (matchLink) {
          const parts = matchLink.split("/room/");
          if (parts[1]) {
            matchId = parts[1];
          }
        }

        allMatches.push({
          date,
          score,
          season,
          matchId,
        });
      });

      page++;

      await sleep(200);
    }

    const uniqueMatches = new Map();

    for (const match of allMatches) {
      if (!match.matchId) continue;

      if (!uniqueMatches.has(match.matchId)) {
        uniqueMatches.set(match.matchId, match);
      }
    }

    const result = Array.from(uniqueMatches.values());

    result.sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    );

    return result;
  } catch (err) {
    console.log(`❌ ${nickname}: ${err.message}`);
    return [];
  }
}

async function main() {
  const output = {};

  for (const team of teams) {
    console.log(`\n=== ${team.name} ===`);

    let bestPlayer = null;
    let bestMatches = [];

    for (const nickname of team.players) {
      console.log(`Checking ${nickname}...`);

      const matches = await getTeamMatches(nickname);

      console.log(
        `${nickname}: ${matches.length} S57 matches`
      );

      if (matches.length > bestMatches.length) {
        bestMatches = matches;
        bestPlayer = nickname;
      }

      await sleep(300);
    }

    console.log(
      `✅ Selected: ${bestPlayer} (${bestMatches.length} matches)`
    );

    output[team.slug] = bestMatches.slice(0, 5);
  }

  const fileContent = `const matches = ${JSON.stringify(
  output,
  null,
  2
)}

export default matches;
`;

  fs.writeFileSync(
    "./src/data/matches.js",
    fileContent,
    "utf8"
  );

  console.log("\n✅ matches.js updated");
}

main();