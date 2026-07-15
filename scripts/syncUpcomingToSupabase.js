import { createClient } from "@supabase/supabase-js";

import upcomingMatches from "../src/data/upcomingMatches.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is missing");
}

if (!supabaseSecretKey) {
  throw new Error(
    "SUPABASE_SECRET_KEY is missing"
  );
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

function normalizeMatch(match) {
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

    best_of:
      match.bestOf ?? null,

    scheduled_at:
      match.scheduledAt || null,

    started_at: null,
    finished_at: null,

    team1_id:
      match.team1?.id || null,

    team1_name:
      match.team1?.name || "TBD",

    team1_slug:
      match.team1?.slug || null,

    team1_logo:
      match.team1?.logo || null,

    team1_score: 0,

    team2_id:
      match.team2?.id || null,

    team2_name:
      match.team2?.name || "TBD",

    team2_slug:
      match.team2?.slug || null,

    team2_logo:
      match.team2?.logo || null,

    team2_score: 0,

    winner_id: null,

    faceit_url:
      match.faceitUrl ||
      `https://www.faceit.com/en/cs2/room/${
        match.matchId || match.id
      }`,

    raw_data: match,

    stats_synced: false,

    updated_at:
      new Date().toISOString(),
  };
}

async function main() {
  if (!Array.isArray(upcomingMatches)) {
    throw new Error(
      "upcomingMatches.js does not export an array"
    );
  }

  if (upcomingMatches.length === 0) {
    console.log(
      "No upcoming matches to sync"
    );

    return;
  }

  const rows = upcomingMatches
    .map(normalizeMatch)
    .filter((match) => match.id);

  const { data, error } = await supabase
    .from("matches")
    .upsert(rows, {
      onConflict: "id",
    })
    .select("id, status, team1_name, team2_name");

  if (error) {
    console.error(
      "Supabase sync failed:",
      error
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    `Synced ${data.length} upcoming matches`
  );

  for (const match of data) {
    console.log(
      `${match.team1_name} vs ${match.team2_name} — ${match.status}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});