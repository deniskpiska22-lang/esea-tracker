import { chromium } from "playwright";

const MATCH_ID =
  "1-97b0e519-10e9-4370-b371-69aa0e6b7439";

const MATCH_URL =
  `https://www.faceit.com/en/cs2/room/${MATCH_ID}/scoreboard`;

const browser = await chromium.launch({
  headless: false,
});

const page = await browser.newPage();

page.on("response", async (response) => {
  const url = response.url();

  if (
    url.includes("scoreboard") ||
    url.includes("statistics") ||
    url.includes("stats")
  ) {
    console.log("\n====================");
    console.log(url);
    console.log(response.status());

    try {
      const text = await response.text();

      console.log(
        text.slice(0, 1000)
      );
    } catch {}
  }
});

await page.goto(MATCH_URL, {
  waitUntil: "networkidle",
});

console.log("Page loaded");

await page.waitForTimeout(15000);

await browser.close();