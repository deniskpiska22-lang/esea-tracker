const processType = String(
  process.env.RAILWAY_PROCESS_TYPE || "live"
).trim().toLowerCase();

const entrypoints = {
  live: "./worker.js",
  automation: "./automationWorker.js",
  stats: "./statsWorker.js",
  tournament: "./tournamentWorker.js",
};

const entrypoint = entrypoints[processType];

if (!entrypoint) {
  throw new Error(
    `Unknown RAILWAY_PROCESS_TYPE=${processType}. ` +
      `Expected one of: ${Object.keys(entrypoints).join(", ")}`
  );
}

console.log(
  `[railway-entrypoint] process=${processType} entrypoint=${entrypoint}`
);

await import(entrypoint);
