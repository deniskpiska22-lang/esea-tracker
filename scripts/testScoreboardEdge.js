import { chromium } from "playwright";

const matchId =
  "1-97b0e519-10e9-4370-b371-69aa0e6b7439";

const context =
  await chromium.launchPersistentContext(
    "C:\\Users\\denis\\AppData\\Local\\Microsoft\\Edge\\User Data",
    {
      channel: "msedge",
      headless: false,
    }
  );

const page = await context.newPage();

await page.goto(
  `https://www.faceit.com/en/cs2/room/${matchId}/scoreboard`
);

await page.waitForTimeout(5000);

const result = await page.evaluate(
  async (id) => {
    const res = await fetch(
      `https://www.faceit.com/api/statistics/v1/cs2/matches/${id}/scoreboard-summary?statsType=2`
    );

    return {
      status: res.status,
      text: await res.text(),
    };
  },
  matchId
);

console.log("STATUS:", result.status);
console.log(result.text.slice(0, 1000));

await context.close();