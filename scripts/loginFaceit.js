import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext();
const page = await context.newPage();

await page.goto("https://www.faceit.com/");

console.log("Войди в FACEIT вручную.");
console.log("После входа нажми Enter в терминале.");

process.stdin.resume();

process.stdin.once("data", async () => {
  await context.storageState({
    path: "faceit-session.json",
  });

  console.log("Сессия сохранена.");

  await browser.close();
  process.exit();
});
