import { spawn } from "node:child_process";

const script =
  process.env.RATING_RECALCULATION_SCRIPT ||
  "./scripts/recalculateRatings.js";

function run() {
  return new Promise((resolve, reject) => {
    console.log("\n=== Recalculate ratings ===");

    const child = spawn(
      process.execPath,
      [
        "--env-file-if-exists=.env.local",
        script,
        "--apply",
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
        return;
      }

      reject(
        new Error(
          `Rating recalculation exited with code ${code}`
        )
      );
    });
  });
}

run()
  .then(() => {
    console.log(
      "\nCurrent ratings and ranks updated. " +
      "Weekly history was not modified."
    );
  })
  .catch((error) => {
    console.error("RATING UPDATE FAILED:", error);
    process.exitCode = 1;
  });
