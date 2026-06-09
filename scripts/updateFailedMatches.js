import fs from "fs";
import { chromium } from "playwright";

const failedIds = JSON.parse(
  fs.readFileSync("./failedMatches.json", "utf8")
);

const results = {};

const browser = await chromium.connectOverCDP(
  "http://127.0.0.1:9222"
);

const context = browser.contexts()[0];

let page = context
  .pages()
  .find((p) => p.url().includes("faceit.com"));

if (!page) {
  throw new Error(
    "Open Faceit in Edge first"
  );
}

console.log(
  "Need retry:",
  failedIds.length
);

for (const matchId of failedIds) {
  try {
    const result = await page.evaluate(
      async (id) => {
        const res = await fetch(
          `https://www.faceit.com/api/statistics/v1/cs2/matches/${id}/scoreboard-summary?statsType=2`
        );

        return {
          status: res.status,
          body: await res.json(),
        };
      },
      matchId
    );

    if (
      result.status !== 200 ||
      !result.body.payload
    ) {
      console.log(
        "FAILED",
        matchId,
        result.status
      );

      continue;
    }

    results[matchId] =
      result.body.payload;

    console.log(
      "SAVED",
      matchId
    );

    fs.writeFileSync(
      "./retryResults.json",
      JSON.stringify(
        results,
        null,
        2
      )
    );

    await page.waitForTimeout(
      5000 + Math.random() * 5000
    );
  } catch (err) {
    console.log(
      "FAILED",
      matchId,
      err.message
    );

    await page.waitForTimeout(
      15000
    );
  }
}

console.log("DONE");