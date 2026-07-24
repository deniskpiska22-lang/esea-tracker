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
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Must match recalculateRatings.js's BASELINE_MAX_AGE_MS — both scripts
// share the same team_ratings.rating_snapshot_at "is today's baseline
// still fresh?" clock, written solely by recalculateRatings.js.
const BASELINE_MAX_AGE_MS = 20 * 60 * 60 * 1000;

// Same computation as snapshotWeeklyRatingHistory.js — reused verbatim so
// both scripts agree on which Monday a given snapshot belongs to.
function getIsoWeekStart(date = new Date()) {
  const value = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );

  const day = value.getUTCDay() || 7;
  value.setUTCDate(
    value.getUTCDate() - day + 1
  );

  return value
    .toISOString()
    .slice(0, 10);
}

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

function getPoints(row) {
  const value =
    row.points ??
    row.rating ??
    row.current_rating;

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.round(parsed)
    : 0;
}

function getMatchesPlayed(row) {
  const parsed = Number(
    row.matches_played ?? 0
  );

  return Number.isFinite(parsed)
    ? Math.round(parsed)
    : 0;
}

function buildCurrentRanks(rows) {
  return [...rows]
    .sort((first, second) => {
      const pointsDifference =
        getPoints(second) - getPoints(first);

      if (pointsDifference !== 0) {
        return pointsDifference;
      }

      return (
        getMatchesPlayed(second) -
        getMatchesPlayed(first)
      );
    })
    .map((row, index) => ({
      ...row,
      computedRank: index + 1,
    }));
}

function groupHistory(rows) {
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

function findWeeklyBaseline(history, cutoff) {
  return history.find(
    (row) =>
      Date.parse(row.created_at) <= cutoff
  ) || null;
}

async function updateRatings(rows) {
  for (
    let index = 0;
    index < rows.length;
    index += WRITE_BATCH_SIZE
  ) {
    const batch = rows.slice(
      index,
      index + WRITE_BATCH_SIZE
    );

    const { error } = await supabase
      .from("team_ratings")
      .upsert(batch, {
        onConflict: "team_id",
      });

    if (error) {
      throw new Error(
        `Unable to update team_ratings: ${error.message}`
      );
    }

    console.log(
      `Ratings updated: ${Math.min(
        index + batch.length,
        rows.length
      )}/${rows.length}`
    );
  }
}

async function insertHistory(rows) {
  for (
    let index = 0;
    index < rows.length;
    index += WRITE_BATCH_SIZE
  ) {
    const batch = rows.slice(
      index,
      index + WRITE_BATCH_SIZE
    );

    const { error } = await supabase
      .from("team_rating_history")
      .upsert(batch, {
        onConflict: "team_id,week_start",
      });

    if (error) {
      throw new Error(
        `Unable to insert rating history: ${error.message}`
      );
    }
  }
}

async function main() {
  const currentRows = await fetchAll(
    "team_ratings",
    `
      team_id,
      team_name,
      slug,
      division,
      points,
      matches_played,
      ranking_status,
      previous_rank,
      rating_snapshot_at
    `
  );

  if (currentRows.length === 0) {
    console.log("No team ratings found.");
    return;
  }

  const rankedRows =
    buildCurrentRanks(currentRows);

  const historyRows = await fetchAll(
    "team_rating_history",
    `
      team_id,
      points,
      world_rank,
      matches_played,
      created_at
    `,
    (query) =>
      query.order("created_at", {
        ascending: false,
      })
  );

  const historyByTeam =
    groupHistory(historyRows);

  const now = new Date();
  const nowIso = now.toISOString();
  const weeklyCutoff =
    now.getTime() - WEEK_MS;

  // previous_points/points_change/rating_snapshot_at are recalculateRatings.js's
  // job now (it runs right before this script in the automatic post-match
  // pipeline) — it already solves the "resets every ~45s cycle instead of
  // accumulating over the day" problem for points via a frozen daily
  // baseline. rank_change has the exact same failure mode (history[0] is
  // re-upserted, i.e. effectively "last cycle", every run), so it gets the
  // same fix here: only take a fresh previous_rank when team_ratings'
  // shared rating_snapshot_at (written solely by recalculateRatings.js) is
  // stale; otherwise keep whatever previous_rank is already stored.
  const updates = rankedRows.map((row) => {
    const teamId = String(row.team_id);
    const history =
      historyByTeam.get(teamId) || [];

    const previous = history[0] || null;
    const weekly = findWeeklyBaseline(
      history,
      weeklyCutoff
    );

    const points = getPoints(row);
    const currentRank = row.computedRank;

    const previousPoints =
      previous
        ? Number(previous.points)
        : points;

    const baselineIsStale =
      !row.rating_snapshot_at ||
      Date.now() - Date.parse(row.rating_snapshot_at) >
        BASELINE_MAX_AGE_MS;

    const freshPreviousRank =
      previous?.world_rank
        ? Number(previous.world_rank)
        : currentRank;

    const previousRank = baselineIsStale
      ? freshPreviousRank
      : Number.isFinite(Number(row.previous_rank))
        ? Number(row.previous_rank)
        : freshPreviousRank;

    const weeklyPoints =
      weekly
        ? Number(weekly.points)
        : previousPoints;

    const weeklyRank =
      weekly?.world_rank
        ? Number(weekly.world_rank)
        : previousRank;

    return {
      team_id: row.team_id,
      team_name: row.team_name,
      slug: row.slug,
      division: row.division,
      points,
      matches_played:
        getMatchesPlayed(row),
      ranking_status:
        row.ranking_status,

      previous_rank: previousRank,

      // Moving from #8 to #5 means +3.
      rank_change:
        previousRank - currentRank,

      weekly_points_change:
        points - weeklyPoints,

      weekly_rank_change:
        weeklyRank - currentRank,

      updated_at: nowIso,
    };
  });

  await updateRatings(updates);

  await insertHistory(
    rankedRows.map((row) => ({
      team_id: String(row.team_id),
      points: getPoints(row),
      world_rank: row.computedRank,
      matches_played:
        getMatchesPlayed(row),
      snapshot_type: "recalculation",
      week_start: getIsoWeekStart(now),
      created_at: nowIso,
    }))
  );

  const changed = updates.filter(
    (row) => row.rank_change !== 0
  );

  console.log(
    JSON.stringify(
      {
        teams: updates.length,
        changedTeams: changed.length,
        snapshotAt: nowIso,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exitCode = 1;
});
