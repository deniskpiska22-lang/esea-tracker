import fs from "node:fs/promises";

const FILE =
  process.argv[2] ||
  "./scripts/autoSyncMatches.js";

let source = await fs.readFile(FILE, "utf8");

function fail(message) {
  throw new Error(
    `${message}\nNo changes were written to ${FILE}.`
  );
}

if (
  source.includes(
    "async function runAutomaticRatingPipeline()"
  )
) {
  console.log(
    `${FILE} already contains the automatic rating pipeline.`
  );
  process.exit(0);
}

/*
 * Add child-process import.
 */
const importMarker =
  'import "dotenv/config";';

if (!source.includes(importMarker)) {
  fail(
    'Could not find import "dotenv/config";'
  );
}

source = source.replace(
  importMarker,
  `${importMarker}
import { spawn } from "node:child_process";`
);

/*
 * Add configuration and runner before main().
 */
const mainMarker =
  "async function main() {";

const mainIndex =
  source.lastIndexOf(mainMarker);

if (mainIndex === -1) {
  fail("Could not find async function main().");
}

const helper = `
const RUN_AUTOMATIC_RATINGS =
  String(
    process.env.RUN_AUTOMATIC_RATINGS || "1"
  ) === "1";

const AUTOMATIC_RATING_SCRIPT =
  process.env.AUTOMATIC_RATING_SCRIPT ||
  "./scripts/recalculateAndSnapshotRatings.js";

async function runAutomaticRatingPipeline() {
  if (!RUN_AUTOMATIC_RATINGS) {
    return {
      ran: false,
      reason: "disabled",
    };
  }

  console.log(
    "\\n=== Automatic rating update ==="
  );

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--env-file=.env.local",
        AUTOMATIC_RATING_SCRIPT,
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
          \`Automatic rating pipeline exited with code \${code}\`
        )
      );
    });
  });

  return {
    ran: true,
    reason: "new-finished-match-stats",
  };
}

`;

source =
  source.slice(0, mainIndex) +
  helper +
  source.slice(mainIndex);

/*
 * Locate the latest main() and add rating execution after
 * syncFinishedMapStats(), before the final JSON output.
 */
const mainStart =
  source.lastIndexOf(mainMarker);

const catchMarker =
  "\nmain().catch";

const mainEnd =
  source.indexOf(catchMarker, mainStart);

if (mainEnd === -1) {
  fail("Could not find main().catch.");
}

let mainBlock =
  source.slice(mainStart, mainEnd);

const statsPatterns = [
  /const\s+matchStats\s*=\s*await\s+syncFinishedMapStats\(\);/,
  /const\s+mapStats\s*=\s*await\s+syncFinishedMapStats\(\);/,
];

let statsVariable = null;
let matchedPattern = null;

for (const pattern of statsPatterns) {
  const match = mainBlock.match(pattern);

  if (match) {
    matchedPattern = pattern;
    statsVariable =
      match[0].includes("matchStats")
        ? "matchStats"
        : "mapStats";
    break;
  }
}

if (!matchedPattern || !statsVariable) {
  fail(
    "Could not find the syncFinishedMapStats() call in main()."
  );
}

const matchedCall =
  mainBlock.match(matchedPattern)[0];

const injectedCall = `${matchedCall}

  /*
   * Only create a rating update when at least one newly
   * completed match received statistics in this run.
   * This prevents empty cron checks from creating fake
   * zero-change snapshots.
   */
  let ratingUpdate = {
    ran: false,
    reason: "no-new-finished-match-stats",
  };

  if (
    Number(${statsVariable}?.synced || 0) > 0
  ) {
    try {
      ratingUpdate =
        await runAutomaticRatingPipeline();
    } catch (ratingError) {
      /*
       * Match synchronization remains successful even if
       * the rating stage fails. The next cron run can retry.
       */
      ratingUpdate = {
        ran: false,
        reason: "failed",
        error:
          ratingError?.message ||
          String(ratingError),
      };

      console.error(
        "Automatic rating update failed:",
        ratingError
      );
    }
  }`;

mainBlock =
  mainBlock.replace(
    matchedPattern,
    injectedCall
  );

/*
 * Add ratingUpdate to the final JSON object.
 * Put it after the existing matchStats/mapStats entry.
 */
const objectEntryPattern =
  statsVariable === "matchStats"
    ? /(\n\s*matchStats,\s*)/
    : /(\n\s*mapStats,\s*)/;

if (!objectEntryPattern.test(mainBlock)) {
  fail(
    `Could not find ${statsVariable} in the final JSON output.`
  );
}

mainBlock =
  mainBlock.replace(
    objectEntryPattern,
    `$1\n        ratingUpdate,\n`
  );

source =
  source.slice(0, mainStart) +
  mainBlock +
  source.slice(mainEnd);

await fs.writeFile(FILE, source, "utf8");

console.log(
  `Patched ${FILE}`
);
console.log(
  "Automatic ratings will run only when matchStats.synced/mapStats.synced is greater than zero."
);
