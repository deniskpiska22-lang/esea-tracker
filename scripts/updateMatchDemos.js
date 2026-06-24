import fs from "fs";
import { chromium } from "playwright";
import matches from "../src/data/matches.js";

const SAVE_FILE = "./src/data/matchDemos.json";

let savedStats = {};

if (fs.existsSync(SAVE_FILE)) {
  const raw = fs.readFileSync(
    SAVE_FILE,
    "utf8"
  );

  if (raw.trim()) {
    savedStats = JSON.parse(raw);
  }
}

const uniqueMatchIds = [
  ...new Set(matches.map((m) => m.matchId)),
];

console.log(
  "Matches:",
  uniqueMatchIds.length
);

console.log(
  "Already saved:",
  Object.keys(savedStats).length
);

const existingIds = new Set(
  Object.keys(savedStats)
);

const newMatchIds = uniqueMatchIds.filter(
  (id) => !existingIds.has(id)
);

console.log(
  "New matches:",
  newMatchIds.length
);

if (newMatchIds.length === 0) {
  console.log("No new matches");
  process.exit(0);
}

const browser = await chromium.connectOverCDP(
  "http://127.0.0.1:9222"
);

const context = browser.contexts()[0];

let page = context
  .pages()
  .find((p) => p.url().includes("faceit.com"));

if (!page) {
  throw new Error(
    "Open FACEIT in Edge first"
  );
}

for (const matchId of newMatchIds) {
  
  try {
    const result = await page.evaluate(
  async (id) => {
    const res = await fetch(
      `https://www.faceit.com/api/match/v2/match/${id}`
    );

    let body = null;

    try {
      body = await res.json();
    } catch {}

    return {
      status: res.status,
      body,
    };
  },
  matchId
);

    if (
      result.status !== 200 ||
      !result.body
    ) {
      console.log(
        "FAILED",
        matchId,
        result.status
      );

      continue;
    }

    savedStats[matchId] =
  result.body.payload?.demoURLs || [];

    fs.writeFileSync(
      SAVE_FILE,
      JSON.stringify(
        savedStats,
        null,
        2
      )
    );

    console.log(
      `SAVED ${matchId} (${Object.keys(savedStats).length}/${uniqueMatchIds.length})`
    );

    await page.waitForTimeout(
      4000 + Math.random() * 4000
    );
  } catch (err) {
    console.log(
      "FAILED",
      matchId,
      err.message
    );

    await page.waitForTimeout(
      10000
    );
  }
}

console.log("DONE");