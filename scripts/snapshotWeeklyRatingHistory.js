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

function getPoints(row) {
  const parsed = Number(
    row.points ??
    row.rating ??
    row.current_rating ??
    0
  );

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

async function fetchAllRatings() {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("team_ratings")
      .select(
        [
          "team_id",
          "team_name",
          "slug",
          "division",
          "points",
          "matches_played",
          "ranking_status",
        ].join(",")
      )
      .range(
        from,
        from + PAGE_SIZE - 1
      );

    if (error) {
      throw new Error(
        `Unable to read team_ratings: ${error.message}`
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

function rankRatings(rows) {
  return [...rows]
    .filter((row) => getPoints(row) > 0)
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
      worldRank: index + 1,
    }));
}

async function writeSnapshots(rows) {
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
        `Unable to save weekly history: ${error.message}`
      );
    }

    console.log(
      `Weekly snapshots: ${Math.min(
        index + batch.length,
        rows.length
      )}/${rows.length}`
    );
  }
}

async function main() {
  const ratings =
    await fetchAllRatings();

  const ranked =
    rankRatings(ratings);

  if (!ranked.length) {
    console.log("No rated teams found.");
    return;
  }

  const nowIso =
    new Date().toISOString();

  const weekStart =
    getIsoWeekStart();

  const snapshots = ranked.map(
    (row) => ({
      team_id:
        String(row.team_id),
      points:
        getPoints(row),
      world_rank:
        row.worldRank,
      matches_played:
        getMatchesPlayed(row),
      snapshot_type:
        "weekly",
      week_start:
        weekStart,
      created_at:
        nowIso,
    })
  );

  await writeSnapshots(snapshots);

  console.log(
    JSON.stringify(
      {
        ok: true,
        weekStart,
        teams:
          snapshots.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    "WEEKLY SNAPSHOT FAILED:",
    error
  );
  process.exitCode = 1;
});
