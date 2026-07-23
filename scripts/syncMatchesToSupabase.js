import { createClient } from "@supabase/supabase-js";

import upcomingMatches from "../src/data/upcomingMatches.js";
import finishedMatches from "../src/data/matches.js";
import teams from "../src/data/teams.generated.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const faceitApiKey = process.env.FACEIT_API_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is missing");
}

if (!supabaseSecretKey) {
  throw new Error("SUPABASE_SECRET_KEY is missing");
}

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const LIVE_STATUSES = new Set([
  "LIVE",
  "ONGOING",
  "MATCH_STATUS_ONGOING",
]);

const FINISHED_STATUSES = new Set([
  "FINISHED",
  "MATCH_STATUS_FINISHED",
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(value = "") {
  return value.replace(/\s+/g, "").toLowerCase();
}

function findLocalTeam(faceitTeamId, fallbackName) {
  return teams.find((team) => {
    if (
      faceitTeamId &&
      team.faceitTeamId === faceitTeamId
    ) {
      return true;
    }

    return (
      fallbackName &&
      normalizeName(team.name) ===
        normalizeName(fallbackName)
    );
  });
}

function normalizeTeam(team = {}) {
  const id =
    team.faction_id ||
    team.team_id ||
    team.premade_team_id ||
    team.id ||
    null;

  const fallbackName =
    team.name || team.nickname || "TBD";

  const localTeam = findLocalTeam(
    id,
    fallbackName
  );

  return {
    id,
    name: localTeam?.name || fallbackName,
    slug: localTeam?.slug || null,
    logo:
      localTeam?.logo ||
      team.avatar ||
      team.logo ||
      null,
  };
}

function upcomingToRow(match) {
  return {
    id: match.matchId || match.id,
    championship_id:
      match.championshipId || null,
    competition_name:
      match.season ||
      match.championshipName ||
      "ESEA League",
    status:
      match.status ||
      "MATCH_STATUS_SCHEDULED",
    best_of: match.bestOf ?? null,
    scheduled_at: match.scheduledAt || null,
    started_at: null,
    finished_at: null,
    team1_id: match.team1?.id || null,
    team1_name: match.team1?.name || "TBD",
    team1_slug: match.team1?.slug || null,
    team1_logo: match.team1?.logo || null,
    team1_score: 0,
    team2_id: match.team2?.id || null,
    team2_name: match.team2?.name || "TBD",
    team2_slug: match.team2?.slug || null,
    team2_logo: match.team2?.logo || null,
    team2_score: 0,
    winner_id: null,
    faceit_url:
      match.faceitUrl ||
      `https://www.faceit.com/en/cs2/room/${
        match.matchId || match.id
      }`,
    raw_data: match,
    stats_synced: false,
    updated_at: new Date().toISOString(),
  };
}

function finishedToRow(match) {
  const team1 =
    teams.find(
      (team) => team.slug === match.teamSlug
    ) || null;

  const team2 =
    teams.find(
      (team) =>
        normalizeName(team.name) ===
        normalizeName(match.opponentName)
    ) || null;

  const [fallbackScore1, fallbackScore2] =
    String(match.boScore || "0:0")
      .split(":")
      .map((value) => Number(value.trim()));

  const team1Score =
    match.teamScore ?? fallbackScore1 ?? 0;
  const team2Score =
    match.opponentScore ?? fallbackScore2 ?? 0;

  return {
    id: match.matchId || match.id,
    championship_id:
      match.championshipId || null,
    competition_name:
      match.season || "ESEA League",
    status:
      match.status ||
      "MATCH_STATUS_FINISHED",
    best_of: match.bestOf ?? null,
    scheduled_at: match.date || null,
    started_at: null,
    finished_at: match.date || null,
    team1_id:
      team1?.faceitTeamId || null,
    team1_name:
      team1?.name || match.teamName || "Unknown",
    team1_slug:
      team1?.slug || match.teamSlug || null,
    team1_logo: team1?.logo || null,
    team1_score: team1Score,
    team2_id:
      team2?.faceitTeamId || null,
    team2_name:
      team2?.name ||
      match.opponentName ||
      "Unknown",
    team2_slug: team2?.slug || null,
    team2_logo: team2?.logo || null,
    team2_score: team2Score,
    winner_id:
      team1Score > team2Score
        ? team1?.faceitTeamId || null
        : team2Score > team1Score
        ? team2?.faceitTeamId || null
        : null,
    faceit_url:
      match.faceitUrl ||
      `https://www.faceit.com/en/cs2/room/${
        match.matchId || match.id
      }`,
    raw_data: match,
    stats_synced: false,
    updated_at: new Date().toISOString(),
  };
}

function faceitToPatch(data) {
  const entries = Object.entries(data?.teams || {});
  const firstEntry = entries[0] || [];
  const secondEntry = entries[1] || [];

  const firstKey = firstEntry[0];
  const secondKey = secondEntry[0];

  const firstTeam = normalizeTeam(
    firstEntry[1] || {}
  );
  const secondTeam = normalizeTeam(
    secondEntry[1] || {}
  );

  const status = data.status || "UNKNOWN";
  const isFinished = FINISHED_STATUSES.has(
    status.toUpperCase()
  );
  const winnerFactionKey = data.results?.winner;

  const firstScore =
    data.results?.score?.[firstKey] ??
    firstEntry[1]?.score ??
    0;

  const secondScore =
    data.results?.score?.[secondKey] ??
    secondEntry[1]?.score ??
    0;

  return {
    status,
    best_of: data.best_of ?? null,
    competition_name:
      data.competition_name ||
      data.competition?.name ||
      undefined,
    scheduled_at: data.scheduled_at
      ? new Date(data.scheduled_at * 1000).toISOString()
      : undefined,
    started_at: data.started_at
      ? new Date(data.started_at * 1000).toISOString()
      : undefined,
    finished_at: data.finished_at
      ? new Date(data.finished_at * 1000).toISOString()
      : isFinished
      ? new Date().toISOString()
      : undefined,
    team1_id: firstTeam.id,
    team1_name: firstTeam.name,
    team1_slug: firstTeam.slug,
    team1_logo: firstTeam.logo,
    team1_score: firstScore,
    team2_id: secondTeam.id,
    team2_name: secondTeam.name,
    team2_slug: secondTeam.slug,
    team2_logo: secondTeam.logo,
    team2_score: secondScore,
    // data.results.winner is a faction key ("faction1"/"faction2"), not a
    // team id — must be translated via firstKey/secondKey before use.
    winner_id:
      winnerFactionKey === firstKey
        ? firstTeam.id
        : winnerFactionKey === secondKey
        ? secondTeam.id
        : isFinished && firstScore > secondScore
        ? firstTeam.id
        : isFinished && secondScore > firstScore
        ? secondTeam.id
        : null,
    faceit_url:
      data.faceit_url ||
      `https://www.faceit.com/en/cs2/room/${
        data.match_id || data.id
      }`,
    raw_data: data,
    updated_at: new Date().toISOString(),
  };
}

function removeUndefined(object) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) => value !== undefined
    )
  );
}

async function upsertStaticMatches() {
  const rowsById = new Map();

  for (const match of upcomingMatches) {
    const row = upcomingToRow(match);
    if (row.id) rowsById.set(row.id, row);
  }

  for (const match of finishedMatches) {
    const row = finishedToRow(match);
    if (row.id) rowsById.set(row.id, row);
  }

  const rows = [...rowsById.values()];

  if (rows.length === 0) {
    console.log("No static matches to sync");
    return;
  }

  const { error } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw error;
  }

  console.log(`Upserted ${rows.length} matches`);
}

async function refreshActiveMatches() {
  if (!faceitApiKey) {
    console.log(
      "FACEIT_API_KEY is missing; skipping live refresh"
    );
    return;
  }

  const { data: activeMatches, error } =
    await supabase
      .from("matches")
      .select("id, status")
      .not(
        "status",
        "in",
        '("FINISHED","MATCH_STATUS_FINISHED")'
      )
      .order("scheduled_at", {
        ascending: true,
      })
      .limit(100);

  if (error) {
    throw error;
  }

  for (const match of activeMatches || []) {
    try {
      const response = await fetch(
        `https://open.faceit.com/data/v4/matches/${encodeURIComponent(
          match.id
        )}`,
        {
          headers: {
            Authorization: `Bearer ${faceitApiKey}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        console.log(
          `FACEIT ${match.id}: ${response.status}`
        );
        continue;
      }

      const data = await response.json();
      const patch = removeUndefined(
        faceitToPatch(data)
      );

      const { error: updateError } =
        await supabase
          .from("matches")
          .update(patch)
          .eq("id", match.id);

      if (updateError) {
        console.log(
          `Update failed ${match.id}: ${updateError.message}`
        );
      } else {
        console.log(
          `${match.id}: ${patch.status} ${patch.team1_score}:${patch.team2_score}`
        );
      }
    } catch (error) {
      console.log(
        `Refresh failed ${match.id}: ${error.message}`
      );
    }

    await sleep(120);
  }
}

async function main() {
  await upsertStaticMatches();
  await refreshActiveMatches();
  console.log("Supabase match sync complete");
}

main().catch((error) => {
  console.error("Sync failed:", error);
  process.exitCode = 1;
});
