import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";

const FACEIT_API_KEY = "1f7e7c47-0d9b-403e-9007-acd463de617b";

const teams = (await import("../src/data/teams.js")).default;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getFaceitPlayer(nickname) {
  try {
    const res = await axios.get(
      `https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(
        nickname
      )}`,
      {
        headers: {
          Authorization: `Bearer ${FACEIT_API_KEY}`,
        },
      }
    );

    return res.data;
  } catch {
    return null;
  }
}

async function getSeason57Rating(nickname) {
  try {
    const { data: html } = await axios.get(
      `https://faceitanalyser.com/hubs/${encodeURIComponent(nickname)}/cs2`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      }
    );

    const $ = cheerio.load(html);

    let rating = null;

    $("tr").each((_, row) => {
      const text = $(row).text();

      const isSeason57 =
        text.includes("S57") &&
        text.includes("Regular Season") &&
        !text.includes("Playoffs");

      if (!isSeason57) return;

      rating = parseFloat(
        $(row).find(".col-hltv").first().text().trim()
      );
    });

    return rating;
  } catch {
    return null;
  }
}

async function main() {
  const output = {};

  for (const team of teams) {
    console.log(`\n=== ${team.name} ===`);

    output[team.slug] = [];

    for (const nickname of team.players) {
      console.log(`→ ${nickname}`);

      const player = await getFaceitPlayer(nickname);

      let elo = undefined;

      if (player?.games?.cs2?.faceit_elo) {
        elo = player.games.cs2.faceit_elo;
      }

      const rating = await getSeason57Rating(nickname);

      const playerData = {
        nickname,
      };

      if (elo) {
        playerData.elo = elo;
      }

      if (rating) {
        playerData.rating = Number(rating.toFixed(2));
      }

      output[team.slug].push(playerData);

      await sleep(500);
    }
  }

  const fileContent =
`const players = ${JSON.stringify(output, null, 2)}

export default players;
`;

  fs.writeFileSync(
    "./src/data/players.js",
    fileContent,
    "utf8"
  );

  console.log("\n✅ players.js updated");
}

main();