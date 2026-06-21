import fs from "fs";
import { chromium } from "playwright";
import matches from "../src/data/matches.js";

const SAVE_FILE = "./src/data/matchStats.json";

console.log("SAVE FILE =", SAVE_FILE);

let savedStats = {};

if (fs.existsSync(SAVE_FILE)) {
  try {
    const raw = fs.readFileSync(
      SAVE_FILE,
      "utf8"
    );

    if (raw.trim()) {
      savedStats = JSON.parse(raw);
    }
  } catch {
    console.log(
      "matchStats.json damaged, starting fresh"
    );
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

const browser = await chromium.connectOverCDP(
  "http://127.0.0.1:9222"
);

const context = browser.contexts()[0];

let page = context
  .pages()
  .find((p) => p.url().includes("faceit.com"));

if (!page) {
  page = await context.newPage();
  await page.goto("https://www.faceit.com/");
}

for (const matchId of uniqueMatchIds) {
  if (savedStats[matchId]) {
    console.log("SKIP", matchId);
    continue;
  }

  try {
    const result = await page.evaluate(
      async (id) => {
        const res = await fetch(
          `https://www.faceit.com/api/statistics/v1/cs2/matches/${id}/scoreboard-summary?statsType=2`
        );

        let body = {};

        try {
          body = await res.json();
        } catch {}

        return {
          status: res.status,
          body,
          headers: {
            limit:
              res.headers.get(
                "ratelimit-limit"
              ),
            remaining:
              res.headers.get(
                "ratelimit-remaining"
              ),
            reset:
              res.headers.get(
                "ratelimit-reset"
              ),
          },
        };
      },
      matchId
    );

    console.log(
      `[${matchId}]`,
      result.status,
      result.headers
    );

    // RATE LIMIT
    if (result.status === 429) {
      const waitSeconds =
        Number(
          result.headers.reset || 30
        ) + 5;

      console.log(
        `RATE LIMIT. Sleeping ${waitSeconds}s`
      );

      await page.waitForTimeout(
        waitSeconds * 1000
      );

      continue;
    }

    const json = result.body;

    if (json.errors) {
      throw new Error(
        json.errors[0]?.message ||
          "Faceit error"
      );
    }

    if (!json.payload) {
      throw new Error("No payload");
    }

    savedStats[matchId] = json.payload;

    fs.writeFileSync(
      SAVE_FILE,
      JSON.stringify(
        savedStats,
        null,
        2
      )
    );

    console.log(
      `SAVED ${matchId}`
    );

    // Очень медленно, чтобы не ловить лимиты
    await page.waitForTimeout(
      10000 +
        Math.floor(
          Math.random() * 5000
        )
    );
  } catch (err) {
    console.log(
      "FAILED",
      matchId,
      err.message
    );

    savedStats[matchId] = {
      failed: true,
      error: err.message,
    };

    fs.writeFileSync(
      SAVE_FILE,
      JSON.stringify(
        savedStats,
        null,
        2
      )
    );

    await page.waitForTimeout(
      30000
    );
  }
}

console.log("DONE");