// One-off/ad hoc: computes a team's ACTUAL rating as of a past Monday by
// replaying finished-match history through the same algorithm
// recalculateRatings.js uses (chronological Elo-style replay from each
// team's initial division points), stopping before any match that finished
// on/after that Monday. This is more accurate than carrying forward the
// closest prior team_rating_history row (see backfillWeeklyRatingSnapshot.js)
// because it accounts for every match that happened between the last
// recorded snapshot and the target date, not just the last snapshot's value.
//
// Usage:
//   node --env-file=.env.local scripts/backfillWeeklyRatingSnapshotFromMatches.js --week-start=2026-08-03

import { createClient } from "@supabase/supabase-js";
import {
  calculateMatchRating,
  getInitialPoints,
  normalizeDivisionName,
  normalizeRegionName,
} from "../src/utils/teamRating.js";

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
  throw new Error("Pass the target Monday as --week-start=YYYY-MM-DD");
}

const cutoffDate = new Date(`${WEEK_START}T00:00:00.000Z`);

if (Number.isNaN(cutoffDate.getTime()) || cutoffDate.getUTCDay() !== 1) {
  throw new Error(`--week-start=${WEEK_START} is not a Monday (UTC)`);
}

const cutoffMs = cutoffDate.getTime();
const cutoffIso = cutoffDate.toISOString();

const APPLY_CHANGES = process.argv.includes("--apply");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 200;

async function fetchAllRows({ table, select, orderColumn, ascending = true, filters = [] }) {
  const result = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);

    for (const filter of filters) {
      if (filter.type === "in") query = query.in(filter.column, filter.value);
    }

    if (orderColumn) {
      query = query.order(orderColumn, { ascending, nullsFirst: false });
    }

    const { data, error } = await query;
    if (error) throw new Error(`Unable to read ${table}: ${error.message}`);

    const page = Array.isArray(data) ? data : [];
    result.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return result;
}

// --- Everything below mirrors recalculateRatings.js's replay algorithm so
// this produces the exact same numbers that script would produce if it were
// run with only matches up to the cutoff. ---

function normalizeTeamId(value) {
  return String(value ?? "").trim();
}

function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isPlaceholderName(value) {
  const name = normalizeTeamName(value);
  return (
    !name ||
    name === "tbd" ||
    name === "bye" ||
    name === "unknown" ||
    name === "null" ||
    name === "walkover"
  );
}

function getMatchDivision(match) {
  return normalizeDivisionName(match.competition_name);
}

function getMatchRegion(match) {
  return normalizeRegionName(match.competition_name);
}

function isTechnicalResult(match, series) {
  const bestOf = Number(match.best_of) || 1;
  return bestOf > 1 && series?.winnerScore === 1 && series?.loserScore === 0;
}

function normalizeSeriesScore(match) {
  const score1 = Number(match.team1_score);
  const score2 = Number(match.team2_score);
  const bestOf = Number(match.best_of) || 1;

  if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 === score2) {
    return null;
  }

  const team1Won = score1 > score2;

  if (bestOf <= 1) {
    return { winnerScore: 1, loserScore: 0, team1Won };
  }

  const requiredWins = Math.ceil(bestOf / 2);
  const highScore = Math.max(score1, score2);
  const lowScore = Math.min(score1, score2);

  if (highScore <= requiredWins && lowScore < highScore) {
    return { winnerScore: highScore, loserScore: lowScore, team1Won };
  }

  return {
    winnerScore: requiredWins,
    loserScore: Math.max(0, requiredWins - 1),
    team1Won,
  };
}

function createInitialRatingState(row) {
  const division = normalizeDivisionName(row.division);
  const initialPoints = getInitialPoints(division);

  return {
    teamId: normalizeTeamId(row.team_id),
    isCurrentTeam: true,
    teamName: row.team_name,
    normalizedName: normalizeTeamName(row.team_name),
    slug: row.slug,
    division,
    points: initialPoints,
    matchesPlayed: 0,
  };
}

function createHistoricalTeamState({ teamId, teamName, division }) {
  const normalizedName = normalizeTeamName(teamName);
  const normalizedDivision = normalizeDivisionName(division);
  const generatedId =
    normalizeTeamId(teamId) || `historical:${normalizedDivision}:${normalizedName}`;
  const initialPoints = getInitialPoints(normalizedDivision);

  return {
    teamId: generatedId,
    teamName: String(teamName ?? "").trim() || "Historical Team",
    normalizedName,
    slug: null,
    division: normalizedDivision,
    isCurrentTeam: false,
    points: initialPoints,
    matchesPlayed: 0,
  };
}

function getMatchTimestamp(match) {
  const date = match.finished_at || match.scheduled_at;
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function buildNameIndex(ratings) {
  const byName = new Map();
  for (const team of ratings.values()) {
    if (!team.normalizedName) continue;
    const current = byName.get(team.normalizedName) || [];
    current.push(team);
    byName.set(team.normalizedName, current);
  }
  return byName;
}

function resolveTeam({ teamId, teamName, matchDivision, ratingsById, ratingsByName }) {
  const normalizedId = normalizeTeamId(teamId);

  if (normalizedId && ratingsById.has(normalizedId)) {
    return { team: ratingsById.get(normalizedId), method: "id" };
  }

  const normalizedName = normalizeTeamName(teamName);
  if (!normalizedName) {
    return { team: null, method: "not-found" };
  }

  const candidates = ratingsByName.get(normalizedName) || [];

  if (candidates.length === 1) {
    return { team: candidates[0], method: "name" };
  }

  if (candidates.length > 1) {
    const sameDivision = candidates.filter((c) => c.division === matchDivision);
    if (sameDivision.length === 1) {
      return { team: sameDivision[0], method: "name-and-division" };
    }
    return { team: null, method: "ambiguous" };
  }

  const historicalTeam = createHistoricalTeamState({
    teamId: normalizedId,
    teamName,
    division: matchDivision,
  });

  ratingsById.set(historicalTeam.teamId, historicalTeam);

  const nameCandidates = ratingsByName.get(normalizedName) || [];
  nameCandidates.push(historicalTeam);
  ratingsByName.set(normalizedName, nameCandidates);

  return { team: historicalTeam, method: "historical" };
}

async function writeSnapshots(rows) {
  for (let index = 0; index < rows.length; index += WRITE_BATCH_SIZE) {
    const batch = rows.slice(index, index + WRITE_BATCH_SIZE);

    const { error } = await supabase
      .from("team_rating_history")
      .upsert(batch, { onConflict: "team_id,week_start,snapshot_type" });

    if (error) {
      throw new Error(`Unable to save backfilled snapshot: ${error.message}`);
    }
  }
}

async function main() {
  console.log(
    APPLY_CHANGES ? "Mode: WRITE TO SUPABASE" : "Mode: DRY RUN (pass --apply to write)"
  );
  console.log(`Target Monday: ${WEEK_START} (cutoff ${cutoffIso})\n`);

  const ratingRows = await fetchAllRows({
    table: "team_ratings",
    select: "team_id, team_name, slug, division, points",
    orderColumn: "team_id",
  });

  const ratingsById = new Map();
  for (const row of ratingRows) {
    const state = createInitialRatingState(row);
    if (state.teamId) ratingsById.set(state.teamId, state);
  }

  const ratingsByName = buildNameIndex(ratingsById);

  const matches = await fetchAllRows({
    table: "matches",
    select: `
      id, competition_name, status, best_of, scheduled_at, finished_at,
      team1_id, team1_name, team1_score, team2_id, team2_name, team2_score
    `,
    orderColumn: "finished_at",
    ascending: true,
    filters: [
      { type: "in", column: "status", value: ["FINISHED", "MATCH_STATUS_FINISHED"] },
    ],
  });

  matches.sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b));

  console.log(`Finished matches total: ${matches.length}`);

  let processed = 0;

  for (const match of matches) {
    if (getMatchTimestamp(match) >= cutoffMs) {
      // Sorted ascending — everything from here on is on/after the cutoff.
      break;
    }

    if (isPlaceholderName(match.team1_name) || isPlaceholderName(match.team2_name)) {
      continue;
    }

    const series = normalizeSeriesScore(match);
    if (!series) continue;

    const matchDivision = getMatchDivision(match);
    const matchRegion = getMatchRegion(match);
    const technicalResult = isTechnicalResult(match, series);

    const resolvedTeam1 = resolveTeam({
      teamId: match.team1_id,
      teamName: match.team1_name,
      matchDivision,
      ratingsById,
      ratingsByName,
    });

    const resolvedTeam2 = resolveTeam({
      teamId: match.team2_id,
      teamName: match.team2_name,
      matchDivision,
      ratingsById,
      ratingsByName,
    });

    if (resolvedTeam1.method === "ambiguous" || resolvedTeam2.method === "ambiguous") {
      continue;
    }

    if (!resolvedTeam1.team || !resolvedTeam2.team) {
      continue;
    }

    const team1 = resolvedTeam1.team;
    const team2 = resolvedTeam2.team;

    if (team1.teamId === team2.teamId) continue;

    const winner = series.team1Won ? team1 : team2;
    const loser = series.team1Won ? team2 : team1;

    const calculation = calculateMatchRating({
      winnerPoints: winner.points,
      loserPoints: loser.points,
      winnerScore: series.winnerScore,
      loserScore: series.loserScore,
      division: matchDivision !== "Unknown" ? matchDivision : winner.division,
      region: matchRegion,
      resultMultiplier: technicalResult ? 0.6 : 1,
      winnerMatchesPlayed: winner.matchesPlayed,
      loserMatchesPlayed: loser.matchesPlayed,
    });

    winner.points = calculation.winnerNewPoints;
    winner.matchesPlayed = calculation.winnerMatchesPlayed;

    loser.points = calculation.loserNewPoints;
    loser.matchesPlayed = calculation.loserMatchesPlayed;

    processed += 1;
  }

  console.log(`Matches replayed (before cutoff): ${processed}`);

  const asOfCutoff = Array.from(ratingsById.values())
    .filter((team) => team.isCurrentTeam && team.points > 0)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.matchesPlayed - a.matchesPlayed;
    })
    .map((team, index) => ({ ...team, worldRank: index + 1 }));

  console.log("\nTop 20 as of cutoff:");
  asOfCutoff.slice(0, 20).forEach((team, i) => {
    console.log(
      `${String(i + 1).padStart(2, " ")}. ${String(team.teamName).padEnd(30, " ")} ${String(
        team.points
      ).padStart(4, " ")} pts (${team.matchesPlayed} matches)`
    );
  });

  const snapshots = asOfCutoff.map((team) => ({
    team_id: team.teamId,
    points: Math.round(team.points),
    world_rank: team.worldRank,
    matches_played: team.matchesPlayed,
    snapshot_type: "weekly",
    week_start: WEEK_START,
    created_at: cutoffIso,
  }));

  if (!APPLY_CHANGES) {
    console.log(`\n${snapshots.length} teams would be written. Nothing saved (dry run).`);
    console.log("Re-run with --apply to write.");
    return;
  }

  await writeSnapshots(snapshots);
  console.log(`\nDone. Backfilled ${snapshots.length} teams for week_start=${WEEK_START}.`);
}

main().catch((error) => {
  console.error("BACKFILL FAILED:", error);
  process.exitCode = 1;
});
