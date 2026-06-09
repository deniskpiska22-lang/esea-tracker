import { chromium } from "playwright";

const browser = await chromium.connectOverCDP(
  "http://localhost:9222"
);

console.log("Connected!");

console.log(
  browser.contexts().length,
  "contexts"
);

const pages = browser.contexts()[0].pages();

console.log(
  pages.map((p) => p.url())
);