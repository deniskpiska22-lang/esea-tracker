import { spawn } from "node:child_process";

const steps = [
  {
    name: "Recalculate ratings",
    script: "./scripts/recalculateRatings.js",
    args: ["--apply"],
  },
  {
    name: "Save rating deltas",
    script: "./scripts/snapshotRatingChanges.js",
    args: [],
  },
];

function run(step) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${step.name} ===`);

    const child = spawn(
      process.execPath,
      [
        "--env-file=.env.local",
        step.script,
        ...step.args,
      ],
      {
        stdio: "inherit",
        shell: false,
      }
    );

    child.on("error", reject);

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${step.name} exited with code ${code}`
          )
        );
      }
    });
  });
}

async function main() {
  for (const step of steps) {
    await run(step);
  }

  console.log(
    "\nRatings and changes updated."
  );
}

main().catch((error) => {
  console.error("PIPELINE FAILED:", error);
  process.exitCode = 1;
});
