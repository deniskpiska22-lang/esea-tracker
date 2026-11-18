import process from 'node:process';
import registry from './config/trackedTournaments.json' with {type:'json'};
import { tournamentRefreshDue } from './lib/tournamentCompletion.js';
// ESEA Tracker — tournament worker.
//
// Runs as a persistent Railway service (see railway.tournament-worker.json),
// same shape as scripts/worker.js: a loop that ticks on an interval and
// never exits. Each tick:
//   1. Reads the tracked tournaments straight from the `tournaments` table
//      (championship_id column) — no redeploy needed to pick up a newly
//      imported tournament, it's live the moment someone runs
//      `npm run import:tournament`.
//   2. For each one (skipping events that not due or verified finished), re-fetches
//      its championship matches from FACEIT and:
//        a. upserts them into the shared `matches` table, so the existing
//           scripts/worker.js (already ticking every ~7s) picks up their
//           live status/score, and the finished-match stats pipeline picks
//           up completed ones — same as any ESEA league match.
//        b. rebuilds the bracket/flat-schedule structure and upserts the
//           `tournaments` row.
//
// This doesn't need to run every few seconds like scripts/worker.js — a
// brand new bracket round only appears on FACEIT once the previous one
// finishes, so a few minutes of lag before a new round becomes visible is
// fine. Individual match scores stay live in between ticks because
// TournamentPage.jsx reads them from `matches` directly, not from the
// bracket JSON's frozen copy.
//
// Run: node --env-file=.env.local scripts/tournamentWorker.js
// Flags/env:
//   TOURNAMENT_WORKER_INTERVAL_MS — tick interval, ms (default 180000 = 3 min)
//   --once                        — run a single pass and exit (for local testing)
//   --dry-run                     — fetch and log, skip every Supabase write
import { createClient } from "@supabase/supabase-js";

import { importTournament, writeToSupabase, writeMatchesToMatchesTable } from "./importTournament.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TICK_INTERVAL_MS = Number(process.env.TOURNAMENT_WORKER_INTERVAL_MS || 180000);
const RUN_ONCE = process.argv.includes("--once");
const DRY_RUN = process.argv.includes("--dry-run");
const REGISTRY_ONLY = process.argv.includes("--registry-only");
const registryById = new Map(registry.map(entry=>[entry.championshipId,entry]));

async function loadTrackedTournaments() {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id,championship_id,name,start_date,end_date,completed_at,lifecycle")
    .not("championship_id", "is", null);

  if (error) {
    throw new Error(`Failed to load tracked tournaments: ${error.message}`);
  }

  const known=new Map((data||[]).map(row=>[row.championship_id,{...row,existing:true}]));
  for(const entry of registry)if(!known.has(entry.championshipId))
    known.set(entry.championshipId,{championship_id:entry.championshipId,name:entry.name,existing:false});
  return [...known.values()].filter(row=>!REGISTRY_ONLY||registryById.has(row.championship_id))
    .sort((a,b)=>Number(registryById.has(b.championship_id))-Number(registryById.has(a.championship_id)));
}

async function refreshOne(tracked) {
  const configured=registryById.get(tracked.championship_id);
  const { entry, rawMatches, championshipName } = await importTournament(tracked.championship_id,{
    id:tracked.existing?undefined:configured?.id,tier:tracked.existing?undefined:configured?.tier,
    name:configured?.name,prizePool:configured?.prizePool,location:configured?.location,
  });

  if (DRY_RUN) {
    console.log(
      `[dry-run] ${entry.name}: ${rawMatches.length} matches, ` +
        `${entry.bracket ? `${entry.bracket.rounds.length}-round bracket` : entry.matches ? `${entry.matches.length} flat matches` : "no matches yet"}`
    );
    return;
  }

  const matchCount = await writeMatchesToMatchesTable(rawMatches, championshipName);
  await writeToSupabase(entry);

  console.log(`  -> ${entry.name}: ${matchCount} matches; source=${entry.lifecycle?.sourceStatus}; completed=${entry.completedAt||"no"}; checked=${entry.lifecycle?.checkedAt}`);
}

async function heartbeat(status,detail) {
  const at=new Date().toISOString();
  const {error}=await supabase.from('worker_status').upsert({worker_name:'tournament-worker',status,
    last_ping:at,updated_at:at,detail},{onConflict:'worker_name'});
  if(error)console.warn('[tournament-worker] heartbeat:',error.message);
}

async function tick() {
  const startedAt = Date.now();
  const tracked = await loadTrackedTournaments();
  await heartbeat('running',`loaded ${tracked.length} tournaments`);
  const targets = tracked.filter((item) => tournamentRefreshDue(item));

  console.log(
    `[tournament-worker] tick: tracking ${tracked.length}, refreshing ${targets.length} ` +
      `(skipped ${tracked.length - targets.length} not due or verified finished)`
  );

  let updated = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      console.log(`- ${target.name} (${target.championship_id})`);
      await refreshOne(target);
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`  failed: ${error.message}`);
    }
  }

  await heartbeat(failed?'degraded':'online',JSON.stringify({updated,failed,tracked:tracked.length}));
  if(RUN_ONCE&&failed)process.exitCode=1;
  console.log(
    `[tournament-worker] tick done in ${Date.now() - startedAt}ms: updated=${updated} failed=${failed}`
  );
}

async function main() {
  if (RUN_ONCE) {
    await tick();
    return;
  }

  console.log(
    `[tournament-worker] starting, interval=${TICK_INTERVAL_MS}ms dry_run=${DRY_RUN}`
  );

  while (true) {
    try {
      await tick();
    } catch (error) {
      console.error("[tournament-worker] tick failed:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, TICK_INTERVAL_MS));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
