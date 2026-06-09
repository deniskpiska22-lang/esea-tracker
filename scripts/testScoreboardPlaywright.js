import { chromium } from "playwright";

const matchId =
  "1-97b0e519-10e9-4370-b371-69aa0e6b7439";

const context =
  await chromium.launchPersistentContext(
    "C:/Users/denis/AppData/Local/Microsoft/Edge/User Data",
    {
      headless: false,
      channel: "msedge",
    }
  );

const page = await context.newPage();

await page.goto(
  `https://www.faceit.com/en/cs2/room/${matchId}`
);

await page.waitForTimeout(5000);

const data = await page.evaluate(
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

console.log(data.status);
console.log(data.text.slice(0, 500));

await browser.close();