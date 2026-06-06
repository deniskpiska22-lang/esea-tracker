
import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";

const teams = (await import("../src/data/teams.js")).default;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getOpponent(matchId, teamName) {
  try {
    const { data: html } = await axios.get(
      `https://faceitanalyser.com/matchanalyser/${matchId}/1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      }
    );

    const $ = cheerio.load(html);

    const teams = $(".name")
      .map((_, el) => $(el).text().trim())
      .get();

    return teams.find(
      (name) =>
        name.toLowerCase() !== teamName.toLowerCase()
    );
  } catch {
    return null;
  }
}

async function getTeamMatches(nickname, teamName) {
  try {
    const MAX_PAGES = 10;

    let page = 1;
    const allMatches = [];
    const uniqueMatchIds = new Set();

    while (page <= MAX_PAGES) {
      const url =
        page === 1
          ? `https://faceitanalyser.com/matches/${encodeURIComponent(nickname)}/cs2`
          : `https://faceitanalyser.com/matches/${encodeURIComponent(nickname)}/cs2?page=${page}`;

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
          const scoreCell = $(row).find(".col-score");

const result = scoreCell.hasClass("positive")
  ? "WIN"
  : scoreCell.hasClass("negative")
  ? "LOSS"
  : "UNKNOWN";

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

        if (!matchId) return;

        allMatches.push({
  date,
  score,
  season,
  matchId,
  result,
});

        uniqueMatchIds.add(matchId);
      });

      page++;

      await sleep(200);
    }

    const grouped = {};

for (const match of allMatches) {
  if (!grouped[match.matchId]) {
    grouped[match.matchId] = {
      date: match.date,
      season: match.season,
      matchId: match.matchId,
      maps: [],
    };
  }

  grouped[match.matchId].maps.push(match);
}

const mergedMatches = [];

for (const series of Object.values(grouped)) {

  let wins = 0;
  let losses = 0;

  for (const map of series.maps) {
    if (map.result === "WIN") wins++;
    else losses++;
  }

  const opponent = await getOpponent(
    series.matchId,
    teamName
  );

  mergedMatches.push({
    date: series.date,
    season: series.season,
    matchId: series.matchId,
    result: wins > losses ? "WIN" : "LOSS",
    opponent,
    boScore: `${wins}-${losses}`,
    mapsPlayed: series.maps.length,
    maps: series.maps,
  });
}

return mergedMatches;

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

      let matches = await getTeamMatches(
  nickname,
  team.name
);
      

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

    output[team.slug] = bestMatches;
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

async function testMatch() {
  const matchId =
    "1-f082f1eb-3b10-493d-9464-d42d767a7557";

  const { data: html } = await axios.get(
    `https://faceitanalyser.com/matchanalyser/${matchId}/1`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    }
  );

  const $ = cheerio.load(html);

  const teams = $(".name")
    .map((_, el) => $(el).text().trim())
    .get();

  console.log(teams);
}

main();