import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";


const FACEIT_API_KEY = "1f7e7c47-0d9b-403e-9007-acd463de617b";

const teams = (await import("../src/data/teams.generated.js")).default;

const TRANSFERS_FILE =
  "./src/data/playerTransfers.json";

const PLAYER_TEAMS_FILE =
  "./src/data/playerTeams.json";

let transferHistory = {};
let previousTeams = {};

if (fs.existsSync(TRANSFERS_FILE)) {
  const raw = fs.readFileSync(
    TRANSFERS_FILE,
    "utf8"
  );

  if (raw.trim()) {
    transferHistory = JSON.parse(raw);
  }
}

if (fs.existsSync(PLAYER_TEAMS_FILE)) {
  const raw = fs.readFileSync(
    PLAYER_TEAMS_FILE,
    "utf8"
  );

  if (raw.trim()) {
    previousTeams = JSON.parse(raw);
  }
}

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

async function getSeason57Ratings(nickname) {
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

    let regularRating = null;
    let regularMatches = 0;
    let playoffRating = null;
    let playoffMatches = 0;

    $("tr").each((_, row) => {
      const text = $(row).text();

      if (!text.includes("S57")) return;

      const isRegular = text.includes("Regular Season");
      const isPlayoff = text.includes("Playoffs");

      if (!isRegular && !isPlayoff) return;

      const matches = parseInt($(row).find(".col-matches").text().trim(), 10);
      const rating = parseFloat($(row).find(".col-hltv").first().text().trim());
      if (isNaN(matches) || isNaN(rating)) return;

      // Берём запись регулярки с максимальным количеством матчей
if (isRegular && matches > regularMatches) {
  regularRating = rating;
  regularMatches = matches;
}

// Берём запись плей-оффа с максимальным количеством матчей
if (isPlayoff && matches > playoffMatches) {
  playoffRating = rating;
  playoffMatches = matches;
}
    });

    // Если есть только регулярка, возвращаем её
    if (regularRating !== null && playoffRating === null) {
      return { rating: regularRating, matches: regularMatches };
    }

    // Если есть и регулярка, и плей-офф, считаем взвешенное среднее
    if (regularRating !== null && playoffRating !== null) {
      const totalMatches = regularMatches + playoffMatches;
      const weightedRating =
        (regularRating * regularMatches + playoffRating * playoffMatches) /
        totalMatches;

      return { rating: weightedRating, matches: totalMatches };
    }

    // Если есть только плей-офф
    if (regularRating === null && playoffRating !== null) {
      return { rating: playoffRating, matches: playoffMatches };
    }

    return { rating: null, matches: 0 };
  } catch {
    return { rating: null, matches: 0 };
  }
}

async function main() {
  const output = {};
  const currentTeams = {};

  for (const team of teams) {
    console.log(`\n=== ${team.name} ===`);
    output[team.slug] = [];

    for (const nickname of team.players) {
      console.log(`→ ${nickname}`);
      currentTeams[nickname] = team.name;

      const player = await getFaceitPlayer(nickname);
      let elo = player?.games?.cs2?.faceit_elo;

      const { rating, matches } = await getSeason57Ratings(nickname);

      if (rating !== null) {
        console.log(
          `RESULT: ${nickname} | ELO=${elo} | RATING=${rating.toFixed(2)} | MATCHES=${matches}`
        );
      }

      const playerData = { nickname };
      if (elo) playerData.elo = elo;
      if (rating !== null) playerData.rating = Number(rating.toFixed(2));

      output[team.slug].push(playerData);

      await sleep(500);
    }
  }

for (const nickname in currentTeams) {
  const currentTeam =
    currentTeams[nickname];

  const previousTeam =
    previousTeams[nickname];

  if (
    previousTeam &&
    previousTeam !== currentTeam
  ) {
    if (!transferHistory[nickname]) {
      transferHistory[nickname] = [];
    }

    transferHistory[nickname].push({
      from: previousTeam,
      to: currentTeam,
      date: new Date()
        .toISOString()
        .split("T")[0],
    });

    console.log(
      `TRANSFER: ${nickname} | ${previousTeam} -> ${currentTeam}`
    );
  }
}

fs.writeFileSync(
  TRANSFERS_FILE,
  JSON.stringify(
    transferHistory,
    null,
    2
  )
);

fs.writeFileSync(
  PLAYER_TEAMS_FILE,
  JSON.stringify(
    currentTeams,
    null,
    2
  )
);

  const fileContent = `const players = ${JSON.stringify(output, null, 2)}

export default players;
`;

  fs.writeFileSync("./src/data/players.js", fileContent, "utf8");
  console.log("\n✅ players.js updated");
}

main();