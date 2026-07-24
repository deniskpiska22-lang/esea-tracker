import { spawn } from "node:child_process";

const fullMode = process.argv.includes("--full");
const sinceArg = process.argv.find((arg) => arg.startsWith("--since-hours="));
const sinceHours = Math.max(
  1,
  Number(
    sinceArg?.split("=")[1] ||
      process.env.POST_MATCH_LOOKBACK_HOURS ||
      24
  )
);

const incrementalArgs = fullMode
  ? ["--full"]
  : [`--since-hours=${sinceHours}`];

const steps = [
  {
    name: "Player profiles",
    script:
      process.env.PLAYER_SYNC_SCRIPT ||
      "./scripts/syncPlayersFromMatchStats.js",
    args: incrementalArgs,
    enabled:
      String(process.env.RUN_PLAYER_SYNC || "1") === "1",
  },
  {
    name: "Player ratings",
    script:
      process.env.PLAYER_RATING_SCRIPT ||
      "./scripts/recalculatePlayerRatings.js",
    args: incrementalArgs,
    enabled:
      String(process.env.RUN_PLAYER_RATINGS_AFTER_SYNC || "1") === "1",
  },
  {
    name: "Starting lineups",
    script:
      process.env.LINEUP_SYNC_SCRIPT ||
      "./scripts/updateStartingLineups.js",
    enabled:
      String(process.env.RUN_LINEUP_SYNC || "1") === "1",
  },
  {
    name: "Team ratings",
    script:
      process.env.RATINGS_SCRIPT ||
      "./scripts/recalculateRatings.js",
    args: ["--apply"],
    enabled:
      String(process.env.RUN_RATINGS_AFTER_SYNC || "1") === "1",
  },
];

function runStep(step) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${step.name} ===`);

    const child = spawn(
      process.execPath,
      [
        "--env-file-if-exists=.env.local",
        step.script,
        ...(step.args || []),
      ],
      {
        stdio: "inherit",
        shell: false,
        env: process.env,
      }
    );

    child.on("error", reject);

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${step.name} exited with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log(
    fullMode
      ? "Post-match mode: FULL"
      : `Post-match mode: INCREMENTAL (${sinceHours}h lookback)`
  );

  for (const step of steps) {
    if (!step.enabled) {
      console.log(`SKIP ${step.name}`);
      continue;
    }

    await runStep(step);
  }

  console.log("\nPost-match pipeline completed.");
}

main().catch((error) => {
  console.error("PIPELINE FAILED:", error);
  process.exitCode = 1;
});
