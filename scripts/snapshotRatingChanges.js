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

// Rank moves depend on every OTHER team's points too, unlike points_change
// which is intrinsic to one team — so "rank right before this team's last
// match" isn't something a per-team replay can produce on its own. Instead:
// where would this team sit in TODAY's field if its own points were still
// at previousPoints (everyone else at their real current standing)? That
// isolates the effect of this team's own last result on today's table,
// using the same points-then-matches_played tiebreak as buildCurrentRanks.
function computeRankForPoints(
  points,
  matchesPlayed,
  rankedRows,
  excludeTeamId
) {
  let better = 0;

  for (const other of rankedRows) {
    if (String(other.team_id) === excludeTeamId) {
      continue;
    }

    const otherPoints = getPoints(other);
    const otherMatches = getMatchesPlayed(other);

    if (
      otherPoints > points ||
      (otherPoints === points && otherMatches > matchesPlayed)
    ) {
      better += 1;
    }
  }

  return better + 1;
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
      previous_points,
      matches_played,
      ranking_status
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

  // previous_points/points_change are recalculateRatings.js's job (it runs
  // right before this script in the automatic post-match pipeline) — each
  // team's own last processed match freezes previous_points to "points
  // right before that match", held until their next match. rank_change
  // mirrors that same "since this team's own last match" intent, but rank
  // can't be produced by a per-team replay (it depends on every OTHER
  // team's points too) — see computeRankForPoints() above.
  const updates = rankedRows.map((row) => {
    const teamId = String(row.team_id);
    const history =
      historyByTeam.get(teamId) || [];

    const weekly = findWeeklyBaseline(
      history,
      weeklyCutoff
    );

    const points = getPoints(row);
    const matchesPlayed = getMatchesPlayed(row);
    const currentRank = row.computedRank;

    const previousPoints = Number.isFinite(
      Number(row.previous_points)
    )
      ? Number(row.previous_points)
      : points;

    const previousRank = computeRankForPoints(
      previousPoints,
      matchesPlayed,
      rankedRows,
      teamId
    );

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
      matches_played: matchesPlayed,
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
