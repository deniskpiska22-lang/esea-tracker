import fs from "node:fs/promises";

const FILE =
  process.argv[2] ||
  "./src/pages/RankingsPage.jsx";

let source = await fs.readFile(
  FILE,
  "utf8"
);

function replaceRequired(
  pattern,
  replacement,
  label
) {
  if (!pattern.test(source)) {
    throw new Error(
      `Could not patch ${label}. ` +
      `The current RankingsPage.jsx differs from the expected version.`
    );
  }

  source = source.replace(
    pattern,
    replacement
  );
}

/*
 * Stop falling back to initial rating.
 * Initial-rating fallback caused values such as +116.
 */
replaceRequired(
  /function getPointsChange\(row,\s*rating\)\s*\{[\s\S]*?\n\}/,
  `function getPointsChange(
  row,
  period = "update"
) {
  const value =
    period === "week"
      ? (
          row?.weekly_points_change ??
          row?.weeklyPointsChange
        )
      : (
          row?.points_change ??
          row?.rating_change ??
          row?.pointsChange ??
          row?.ratingChange
        );

  const number = Number(value);

  return Number.isFinite(number)
    ? Math.round(number)
    : 0;
}`,
  "getPointsChange"
);

replaceRequired(
  /function getRankChange\(row\)\s*\{[\s\S]*?\n\}/,
  `function getRankChange(
  row,
  period = "update"
) {
  const value =
    period === "week"
      ? (
          row?.weekly_rank_change ??
          row?.weeklyRankChange
        )
      : (
          row?.rank_change ??
          row?.position_change ??
          row?.rankChange ??
          row?.positionChange
        );

  const number = Number(value);

  return Number.isFinite(number)
    ? Math.round(number)
    : 0;
}`,
  "getRankChange"
);

/*
 * Add period state next to search state.
 */
replaceRequired(
  /const \[searchQuery,\s*setSearchQuery\]\s*=\s*useState\(""\);/,
  `const [searchQuery, setSearchQuery] =
    useState("");

  const [changePeriod, setChangePeriod] =
    useState("update");`,
  "changePeriod state"
);

/*
 * Make merged team deltas period-aware.
 */
source = source.replace(
  /getPointsChange\(\s*ratingRow,\s*rating\s*\)/g,
  "getPointsChange(ratingRow, changePeriod)"
);

source = source.replace(
  /getRankChange\(\s*ratingRow\s*\)/g,
  "getRankChange(ratingRow, changePeriod)"
);

/*
 * Ensure memo dependencies include changePeriod.
 */
source = source.replace(
  /\[ratingRows,\s*staticTeamIndexes\]/g,
  "[ratingRows, staticTeamIndexes, changePeriod]"
);

/*
 * Add a compact period selector before the rankings table.
 */
const tableMarker =
  '<div className="mx-auto max-w-7xl p-4 md:p-8">';

const selector = `
      <div className="mx-auto max-w-7xl px-4 pt-5 md:px-8">
        <div className="flex items-center justify-end gap-2">
          <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600">
            Changes
          </span>

          <button
            type="button"
            onClick={() => setChangePeriod("update")}
            className={\`rounded-lg border px-3 py-1.5 text-xs font-bold transition \${
              changePeriod === "update"
                ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                : "border-white/5 bg-[#0f131a] text-gray-500 hover:text-white"
            }\`}
          >
            Last update
          </button>

          <button
            type="button"
            onClick={() => setChangePeriod("week")}
            className={\`rounded-lg border px-3 py-1.5 text-xs font-bold transition \${
              changePeriod === "week"
                ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                : "border-white/5 bg-[#0f131a] text-gray-500 hover:text-white"
            }\`}
          >
            7 days
          </button>
        </div>
      </div>

`;

if (!source.includes("setChangePeriod(\"update\")")) {
  const index = source.indexOf(tableMarker);

  if (index === -1) {
    throw new Error(
      "Could not find rankings table marker."
    );
  }

  source =
    source.slice(0, index) +
    selector +
    source.slice(index);
}

await fs.writeFile(
  FILE,
  source,
  "utf8"
);

console.log(
  `Patched ${FILE}`
);
