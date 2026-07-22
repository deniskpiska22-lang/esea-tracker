import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE_SIZE = Math.max(1, Number(process.env.NORMALIZED_STATS_PAGE_SIZE || 250));
const CONCURRENCY = Math.max(1, Number(process.env.NORMALIZED_STATS_CONCURRENCY || 5));
const ONLY_MATCH_ID = process.argv.includes("--match")
  ? process.argv[process.argv.indexOf("--match") + 1]
  : null;

async function runPool(items, worker, size) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, Math.max(items.length, 1)) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function loadPage(from) {
  let query = supabase
    .from("matches")
    .select("id", { count: "exact" })
    .or("map_scores.not.is.null,player_stats.not.is.null")
    .order("id", { ascending: true });

  if (ONLY_MATCH_ID) {
    query = query.eq("id", ONLY_MATCH_ID);
  } else {
    query = query.range(from, from + PAGE_SIZE - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

async function main() {
  let from = 0;
  let checked = 0;
  let synced = 0;
  let failed = 0;
  let total = null;

  while (true) {
    const { rows, count } = await loadPage(from);
    total ??= count;
    if (!rows.length) break;

    await runPool(rows, async ({ id }) => {
      checked += 1;
      const { data, error } = await supabase.rpc("sync_normalized_match_stats", {
        p_match_id: id,
      });

      if (error) {
        failed += 1;
        console.error(`FAILED ${id}: ${error.message}`);
        return;
      }

      synced += 1;
      console.log(`SYNCED ${id} | maps=${data?.maps ?? 0} players=${data?.players ?? 0}`);
    }, CONCURRENCY);

    if (ONLY_MATCH_ID || rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    console.log(`Progress: ${checked}/${total}`);
  }

  console.log(JSON.stringify({ total, checked, synced, failed }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exitCode = 1;
});
