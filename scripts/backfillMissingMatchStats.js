import "dotenv/config";
import { spawn } from "node:child_process";

const rounds = Number(
  process.env.STATS_BACKFILL_ROUNDS || 20
);

const batchSize = Number(
  process.env.MAP_STATS_BATCH_SIZE || 50
);

function runOnce(index) {
  return new Promise((resolve, reject) => {
    console.log(
      `\n=== Backfill pass ${index}/${rounds}; batch=${batchSize} ===`
    );

    const child = spawn(
      process.execPath,
      [
        "--env-file=.env.local",
        "scripts/autoSyncMatches.js",
        "--live",
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          MAP_STATS_BATCH_SIZE:
            String(batchSize),
          MATCH_SYNC_CONCURRENCY:
            process.env.STATS_BACKFILL_CONCURRENCY ||
            "2",
        },
      }
    );

    child.on("error", reject);

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Backfill pass ${index} failed with exit code ${code}`
          )
        );
      }
    });
  });
}

for (
  let index = 1;
  index <= rounds;
  index += 1
) {
  await runOnce(index);
}

console.log(
  "\nStats backfill passes completed."
);
