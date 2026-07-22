// scripts/importJsonToSupabase.js
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const BATCH_SIZE = Number(process.env.IMPORT_BATCH_SIZE || 250);

function splitIntoBatches(items, size) {
  const batches = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

async function readJsonFiles(directory) {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

async function importFile({
  filePath,
  table,
  conflictColumn,
  transform = (row) => row,
}) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  const rows = Array.isArray(parsed)
    ? parsed
    : parsed.data || parsed.items || parsed.matches || [];

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`EMPTY: ${filePath}`);
    return;
  }

  const normalizedRows = rows
    .map(transform)
    .filter(Boolean);

  const batches = splitIntoBatches(
    normalizedRows,
    BATCH_SIZE
  );

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];

    const { error } = await supabase
      .from(table)
      .upsert(batch, {
        onConflict: conflictColumn,
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(
        `${table}: ${filePath}, batch ${index + 1}: ${error.message}`
      );
    }

    console.log(
      `${table}: ${path.basename(filePath)} — ` +
      `${index + 1}/${batches.length}, rows=${batch.length}`
    );
  }
}

async function importDirectory(config) {
  try {
    await fs.access(config.directory);
  } catch {
    console.log(`SKIP: directory not found: ${config.directory}`);
    return;
  }

  const files = await readJsonFiles(config.directory);

  for (const filePath of files) {
    await importFile({
      ...config,
      filePath,
    });
  }
}

async function main() {
  await importDirectory({
    directory: "./data/teams",
    table: "teams",
    conflictColumn: "id",
  });

  await importDirectory({
    directory: "./data/matches",
    table: "matches",
    conflictColumn: "id",
  });

  await importDirectory({
    directory: "./data/maps",
    table: "match_maps",
    conflictColumn: "id",
  });

  await importDirectory({
    directory: "./data/player-stats",
    table: "match_player_stats",
    conflictColumn: "match_id,player_id,map_id",
  });

  console.log("Import completed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});