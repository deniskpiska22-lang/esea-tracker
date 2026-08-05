// One-off/ad hoc: reconstructs a missed weekly rating snapshot from
// already-recorded team_rating_history rows instead of using today's live
// points. For each team, picks the most recent history row (any
// snapshot_type) at or before the target week's Monday 00:00 UTC — the same
// "closest snapshot before cutoff" logic snapshotRatingChanges.js already
// uses for weekly_points_change — and re-inserts it as that week's
// snapshot_type='weekly' row.
//
// Usage:
//   node --env-file=.env.local scripts/backfillWeeklyRatingSnapshot.js --week-start=2026-08-03

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
  );
}

const weekStartArg = process.argv.find((arg) =>
  arg.startsWith("--week-start=")
);

const WEEK_START = weekStartArg
  ? weekStartArg.slice("--week-start=".length)
  : null;

if (!WEEK_START || !/^\d{4}-\d{2}-\d{2}$/.test(WEEK_START)) {
  throw new Error(
    "Pass the target Monday as --week-start=YYYY-MM-DD"
  );
}

const cutoffDate = new Date(`${WEEK_START}T00:00:00.000Z`);

if (
  Number.isNaN(cutoffDate.getTime()) ||
  cutoffDate.getUTCDay() !== 1
) {
  throw new Error(
    `--week-start=${WEEK_START} is not a Monday (UTC)`
  );
}

const cutoffMs = cutoffDate.getTime();
const cutoffIso = cutoffDate.toISOString();

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 200;

async function fetchAll(table, select, configure) {
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);

    if (configure) {
      query = configure(query);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Unable to read ${table}: ${error.message}`
      );
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

function groupByTeam(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const teamId = String(row.team_id);

    if (!grouped.has(teamId)) {
      grouped.set(teamId, []);
    }

    grouped.get(teamId).push(row);
  }

  for (const teamRows of grouped.values()) {
    teamRows.sort(
      (first, second) =>
        Date.parse(second.created_at) -
        Date.parse(first.created_at)
    );
  }

  return grouped;
}

function findBaseline(history) {
  return (
    history.find(
      (row) => Date.parse(row.created_at) <= cutoffMs
    ) || null
  );
}

async function main() {
  const history = await fetchAll(
    "team_rating_history",
    "team_id, points, world_rank, matches_played, created_at"
  );

  const historyByTeam = groupByTeam(history);

  const snapshots = [];
  const skipped = [];

  for (const [teamId, teamHistory] of historyByTeam) {
    const baseline = findBaseline(teamHistory);

    if (!baseline) {
      skipped.push(teamId);
      continue;
    }

    snapshots.push({
      team_id: teamId,
      points: baseline.points,
      world_rank: baseline.world_rank,
      matches_played: baseline.matches_played,
      snapshot_type: "weekly",
      week_start: WEEK_START,
      created_at: cutoffIso,
    });
  }

  if (!snapshots.length) {
    console.log("Nothing to backfill.");
    return;
  }

  for (
    let index = 0;
    index < snapshots.length;
    index += WRITE_BATCH_SIZE
  ) {
    const batch = snapshots.slice(
      index,
      index + WRITE_BATCH_SIZE
    );

    const { error } = await supabase
      .from("team_rating_history")
      .upsert(batch, {
        onConflict: "team_id,week_start,snapshot_type",
      });

    if (error) {
      throw new Error(
        `Unable to save backfilled snapshot: ${error.message}`
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        weekStart: WEEK_START,
        cutoff: cutoffIso,
        teamsBackfilled: snapshots.length,
        teamsSkipped: skipped.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("BACKFILL FAILED:", error);
  process.exitCode = 1;
});
