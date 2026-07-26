// Imports a FACEIT championship into the `tournaments` Supabase table (the
// live source TournamentPage.jsx reads at runtime) and, by default, also
// into src/data/tournaments.generated.json (the bundled seed/fallback used
// when Supabase has no matching row — no DB configured, or brand new repo
// checkout).
//
// Usage:
//   node --env-file=.env.local scripts/importTournament.js <championshipId> --tier <S|A|B|C> [--id <slug>] [--location <text>] [--dry-run] [--no-json]
//
// What it does:
// - Pulls championship metadata + the full match list from FACEIT's official
//   Data API v4 (open.faceit.com, needs FACEIT_API_KEY) — this is the
//   authoritative source for round/group/type data used to decide between a
//   real bracket and a flat schedule.
// - Pulls the team roster from FACEIT's public website API
//   (www.faceit.com/api/championships/v1/...) — no auth needed, just a
//   believable User-Agent/Referer (same approach already used by
//   scripts/v2/faceitStandingsClient.js). That endpoint includes each team's
//   avatar directly, so there's no need for per-team follow-up calls.
// - Never creates new team records. Participants are matched against
//   src/data/teams.generated.js by faceitTeamId only, for a slug/logo link.
//   Unmatched teams just render with their name and no link.
// - Builds a real single-elimination bracket when FACEIT reports a clean
//   bracket format (`type: "bracket"`, one group). If the championship
//   metadata is unavailable (archived/expired — matches stay queryable even
//   then), it infers a bracket directly from the matches instead: a team
//   that lost never reappears in a later round. Round sizes can be uneven
//   (byes for non-power-of-2 team counts) and still count as a bracket.
//   Anything else (Swiss/ladder formats, round robin) falls back to a flat
//   chronological match list.
// - The exact left-to-right slot of each match is reconstructed too, not
//   just its round: FACEIT doesn't expose a seed/position for most events,
//   so each match's tree position is derived by walking every team's path
//   backwards from the grand final (each team's previous match is that
//   match's "feeder"). This is what makes the rendered bracket match the
//   real one instead of just grouping matches by round number.
// - `tier` is editorial and is never inferred — pass it explicitly for new
//   imports. Re-importing an existing championshipId preserves its current
//   tier unless --tier is passed again (checked against Supabase first,
//   then the local JSON file, since Supabase is the more current copy once
//   scripts/refreshTournaments.js is running on a schedule).
// - Full multi-group tournaments (group stage + separate playoffs bracket,
//   like a Major) are NOT reconstructed automatically yet — those still
//   need the `groups` field hand-authored. This script only ever writes
//   `bracket` or `matches`.
import fs from "fs/promises";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import teams from "../src/data/teams.generated.js";

const FACEIT_API_KEY = process.env.FACEIT_API_KEY;

if (!FACEIT_API_KEY) {
  throw new Error("FACEIT_API_KEY is required");
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.warn(
    "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — will only update tournaments.generated.json, not the live table."
  );
}

const OPEN_API_BASE = "https://open.faceit.com/data/v4";
const WEB_API_BASE = "https://www.faceit.com/api";
const WEB_API_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
  Referer: "https://www.faceit.com/",
};

const DATA_PATH = new URL("../src/data/tournaments.generated.json", import.meta.url);

async function fetchOpenApi(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${FACEIT_API_KEY}` },
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`${url} -> ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function fetchWebApi(url) {
  const res = await fetch(url, { headers: WEB_API_HEADERS });

  if (!res.ok) {
    throw new Error(`${url} -> ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function fetchAllOpenApiPages(urlBuilder, limit = 20, hardCap = 2000) {
  const all = [];
  let offset = 0;

  while (true) {
    const json = await fetchOpenApi(urlBuilder(offset, limit));
    const items = json?.items || [];
    all.push(...items);

    if (items.length < limit || offset > hardCap) {
      break;
    }

    offset += limit;
  }

  return all;
}

async function fetchAllSubscriptions(championshipId) {
  const all = [];
  let offset = 0;
  const limit = 20; // the website API rejects limit > 20

  while (true) {
    const json = await fetchWebApi(
      `${WEB_API_BASE}/championships/v1/championship/${encodeURIComponent(
        championshipId
      )}/subscription?offset=${offset}&limit=${limit}`
    );
    const items = json?.payload?.items || [];
    all.push(...items);

    if (items.length < limit) {
      break;
    }

    offset += limit;
  }

  return all;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toIsoDate(ms) {
  if (!ms) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function findLocalTeamByFaceitId(faceitTeamId) {
  return teams.find((team) => team.faceitTeamId === faceitTeamId) || null;
}

// "preRegistered" means interest expressed but not yet confirmed — FACEIT's
// own participant count on the championship page excludes it too.
const EXCLUDED_SUBSCRIPTION_STATUSES = new Set([
  "withdrawn",
  "declined",
  "kicked",
  "rejected",
  "preRegistered",
]);

function buildTeams(subscriptions) {
  const confirmed = subscriptions.filter(
    (sub) => !EXCLUDED_SUBSCRIPTION_STATUSES.has(sub.status)
  );

  return confirmed.map((sub) => {
    const local = findLocalTeamByFaceitId(sub.team.id);

    return {
      name: sub.team.name,
      logo: local?.logo || sub.team.avatar || null,
      slug: local?.slug || null,
    };
  });
}

function toBracketMatchTeam(faction) {
  if (!faction) return null;
  return { name: faction.name || "TBD", logo: faction.avatar || null };
}

function toBracketMatch(match) {
  const winner = match.results?.winner || null;

  return {
    team1: toBracketMatchTeam(match.teams?.faction1),
    team2: toBracketMatchTeam(match.teams?.faction2),
    score1: match.results?.score?.faction1 ?? null,
    score2: match.results?.score?.faction2 ?? null,
    winner: winner === "faction1" ? 1 : winner === "faction2" ? 2 : null,
    matchId: match.match_id,
  };
}

// A team that lost never reappears in a later round — true for single
// elimination (even with byes, which is why round sizes can be uneven and
// don't need to halve cleanly), false for round robin / Swiss / ladder
// formats where a loss doesn't knock a team out.
function isSingleEliminationBracket(matches) {
  const rounds = new Set(matches.map((match) => match.round ?? 0));
  if (rounds.size < 2) return false;

  const sorted = matches.slice().sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  const eliminated = new Set();

  for (const match of sorted) {
    const id1 = match.teams?.faction1?.faction_id;
    const id2 = match.teams?.faction2?.faction_id;
    const winner = match.results?.winner;

    if ((id1 && eliminated.has(id1)) || (id2 && eliminated.has(id2))) {
      return false;
    }

    if (winner === "faction1" && id2) eliminated.add(id2);
    if (winner === "faction2" && id1) eliminated.add(id1);
  }

  return true;
}

// Prefer FACEIT's own declared format when the championship endpoint has
// it; archived/expired championships 404 there (still fine — matches stay
// queryable), so fall back to inferring straight from the match data.
function shouldBuildBracket(meta, matches) {
  if (meta) {
    return meta.type === "bracket" && (meta.total_groups ?? 1) <= 1;
  }

  return isSingleEliminationBracket(matches);
}

// FACEIT doesn't expose a bracket slot/seed for most events, so the actual
// tree position of each match is reconstructed from the data itself: since
// a losing team never reappears, each team's previous match (the one it
// played in the nearest earlier round) is that match's "feeder". Walking
// that back from the grand final and numbering nodes 1, 2n, 2n+1 as we go
// gives the exact left-to-right bracket order — matches, not the round
// count, are what any team's path actually depends on, so this holds even
// with byes and uneven round sizes.
function computeBracketPositions(matches) {
  const sorted = matches.slice().sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  const lastMatchByTeam = new Map();

  for (const match of sorted) {
    const id1 = match.teams?.faction1?.faction_id;
    const id2 = match.teams?.faction2?.faction_id;
    match._feeder1 = id1 ? lastMatchByTeam.get(id1) || null : null;
    match._feeder2 = id2 ? lastMatchByTeam.get(id2) || null : null;
    if (id1) lastMatchByTeam.set(id1, match);
    if (id2) lastMatchByTeam.set(id2, match);
  }

  const maxRound = Math.max(...sorted.map((match) => match.round ?? 0));
  const finalMatches = sorted.filter((match) => (match.round ?? 0) === maxRound);
  const positions = new Map();

  function assign(match, position) {
    if (!match) return;
    positions.set(match.match_id, position);
    assign(match._feeder1, position * 2);
    assign(match._feeder2, position * 2 + 1);
  }

  finalMatches.forEach((match, index) => assign(match, index + 1));

  return positions;
}

function buildBracket(matches) {
  const positions = computeBracketPositions(matches);
  const byRound = new Map();

  for (const match of matches) {
    const key = match.round ?? 0;
    if (!byRound.has(key)) byRound.set(key, []);
    byRound.get(key).push(match);
  }

  for (const roundMatches of byRound.values()) {
    roundMatches.sort(
      (a, b) => (positions.get(a.match_id) ?? Infinity) - (positions.get(b.match_id) ?? Infinity)
    );
  }

  const roundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  const totalRounds = roundNumbers.length;

  return {
    rounds: roundNumbers.map((round, index) => {
      const roundMatches = byRound.get(round);
      const fromEnd = totalRounds - 1 - index;

      // Uneven bracket sizes (byes for non-power-of-2 team counts) mean
      // match count alone can't label every round — only the last few
      // rounds have a conventional name, the rest are just "Round N".
      const name =
        fromEnd === 0
          ? "Grand final"
          : fromEnd === 1 && roundMatches.length === 2
            ? "Semi-finals"
            : fromEnd === 2 && roundMatches.length === 4
              ? "Quarter-finals"
              : `Round ${index + 1}`;

      return { name, matches: roundMatches.map(toBracketMatch) };
    }),
  };
}

function buildFlatMatches(matches) {
  return matches
    .slice()
    .sort((a, b) => (a.scheduled_at || 0) - (b.scheduled_at || 0))
    .map((match) => {
      const bracketMatch = toBracketMatch(match);
      return {
        id: bracketMatch.matchId,
        team1: bracketMatch.team1,
        team2: bracketMatch.team2,
        score1: bracketMatch.score1,
        score2: bracketMatch.score2,
        date: match.scheduled_at ? new Date(match.scheduled_at * 1000).toISOString() : null,
      };
    });
}

async function readJsonList() {
  const raw = await fs.readFile(DATA_PATH, "utf8").catch(() => "[]");
  return JSON.parse(raw);
}

function entryFromDbRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    championshipId: row.championship_id,
    name: row.name,
    logo: row.logo,
    tier: row.tier,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    url: row.url,
    prizePool: row.prize_pool,
    description: row.description,
    formats: row.formats,
    teams: row.teams,
    bracket: row.bracket,
    groups: row.groups,
    prizeDistribution: row.prize_distribution,
    mapPool: row.map_pool,
    relatedEvents: row.related_events,
    matches: row.matches,
  };
}

function entryToDbRow(entry) {
  return {
    id: entry.id,
    championship_id: entry.championshipId,
    name: entry.name,
    logo: entry.logo,
    tier: entry.tier,
    location: entry.location,
    start_date: entry.startDate,
    end_date: entry.endDate,
    url: entry.url,
    prize_pool: entry.prizePool,
    description: entry.description,
    formats: entry.formats,
    teams: entry.teams,
    bracket: entry.bracket,
    groups: entry.groups,
    prize_distribution: entry.prizeDistribution,
    map_pool: entry.mapPool,
    related_events: entry.relatedEvents,
    matches: entry.matches,
    updated_at: new Date().toISOString(),
  };
}

// Supabase is the more current copy once refreshes are running on a
// schedule, so it wins over the bundled JSON when both have the
// championship on record.
async function findExisting(championshipId, jsonList) {
  if (supabase) {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("championship_id", championshipId)
      .maybeSingle();

    if (error) {
      console.warn("Supabase lookup failed, falling back to local file:", error.message);
    } else if (data) {
      return entryFromDbRow(data);
    }
  }

  return jsonList.find((item) => item.championshipId === championshipId) || null;
}

// The importable core, shared by the CLI entrypoint below and
// scripts/refreshTournaments.js.
export async function importTournament(championshipId, options = {}) {
  const jsonList = options.jsonList || (await readJsonList());
  const existing = await findExisting(championshipId, jsonList);

  console.log(`Fetching championship ${championshipId}...`);

  const meta = await fetchOpenApi(`${OPEN_API_BASE}/championships/${championshipId}`);

  if (!meta) {
    console.warn(
      "Championship metadata not found (archived or expired) — falling back to match-derived data only."
    );
  }

  const matches = await fetchAllOpenApiPages(
    (offset, limit) =>
      `${OPEN_API_BASE}/championships/${championshipId}/matches?type=all&offset=${offset}&limit=${limit}`
  );

  const subscriptions = await fetchAllSubscriptions(championshipId);

  console.log(`Found ${matches.length} matches, ${subscriptions.length} team subscriptions.`);

  const teamsList = buildTeams(subscriptions);
  const localMatchCount = teamsList.filter((t) => t.slug).length;

  console.log(
    `${localMatchCount} of ${teamsList.length} teams already tracked in the local rating.`
  );

  const useBracket = shouldBuildBracket(meta, matches);
  const bracket = useBracket && matches.length > 0 ? buildBracket(matches) : null;
  const flatMatches = !useBracket && matches.length > 0 ? buildFlatMatches(matches) : null;

  console.log(
    bracket
      ? `Built a ${bracket.rounds.length}-round bracket.`
      : flatMatches
        ? `No clean bracket format — built a flat schedule of ${flatMatches.length} matches.`
        : "No matches yet — bracket/matches left empty."
  );

  const id = options.id || existing?.id || slugify(meta?.name || championshipId);
  const tier = options.tier || existing?.tier || null;

  if (!tier) {
    console.warn(
      "No tier passed and none on record — the tournament will render with an unlabeled tier badge until you set one."
    );
  }

  const entry = {
    id,
    championshipId,
    name: meta?.name || existing?.name || championshipId,
    logo: meta?.avatar || existing?.logo || null,
    tier,
    location: options.location || existing?.location || "Online",
    startDate: toIsoDate(meta?.championship_start) || existing?.startDate || null,
    endDate: existing?.endDate || toIsoDate(meta?.championship_start) || null,
    url: meta?.faceit_url?.replace("{lang}", "en") || existing?.url || null,
    prizePool:
      meta?.total_prizes > 0
        ? `$${meta.total_prizes.toLocaleString("en-US")}`
        : existing?.prizePool || null,
    description: meta?.description || existing?.description || null,
    formats: existing?.formats || null,
    teams: teamsList,
    bracket,
    groups: existing?.groups || null,
    prizeDistribution: existing?.prizeDistribution || null,
    mapPool: existing?.mapPool || null,
    relatedEvents: existing?.relatedEvents || null,
    matches: flatMatches,
  };

  return { entry, wasExisting: Boolean(existing), rawMatches: matches, championshipName: entry.name };
}

// Converts a raw FACEIT championship-match into the shared `matches` table
// row shape (see supabase/migrations/0001_baseline_schema.sql and
// scripts/autoSyncMatches.js's internalToRow) so it slots into the exact
// same pipeline as any other match: scripts/worker.js (running on Railway)
// refreshes its live status every ~7s regardless of where the row came
// from, and the finished-match stats jobs pick it up the same way too.
// Only columns owned by discovery are set — stats_synced/player_stats/
// demo_urls etc. are left alone so an upsert here never clobbers what those
// other pipelines have already written.
export function toMatchesTableRow(match, competitionName) {
  const faction1 = match.teams?.faction1;
  const faction2 = match.teams?.faction2;
  const winner = match.results?.winner;

  return {
    id: match.match_id,
    championship_id: match.competition_id || null,
    competition_name: competitionName || match.competition_name || null,
    status: match.status || "SCHEDULED",
    best_of: match.best_of ?? null,
    scheduled_at: match.scheduled_at ? new Date(match.scheduled_at * 1000).toISOString() : null,
    started_at: match.started_at ? new Date(match.started_at * 1000).toISOString() : null,
    finished_at: match.finished_at ? new Date(match.finished_at * 1000).toISOString() : null,
    team1_id: faction1?.faction_id || null,
    team1_name: faction1?.name || null,
    team1_logo: faction1?.avatar || null,
    team1_score: match.results?.score?.faction1 ?? 0,
    team2_id: faction2?.faction_id || null,
    team2_name: faction2?.name || null,
    team2_logo: faction2?.avatar || null,
    team2_score: match.results?.score?.faction2 ?? 0,
    winner_id:
      winner === "faction1"
        ? faction1?.faction_id || null
        : winner === "faction2"
          ? faction2?.faction_id || null
          : null,
    faceit_url: match.faceit_url?.replace("{lang}", "en") || null,
  };
}

export async function writeMatchesToMatchesTable(rawMatches, competitionName) {
  if (!supabase || rawMatches.length === 0) {
    return 0;
  }

  const rows = rawMatches
    .filter((match) => match.match_id)
    .map((match) => toMatchesTableRow(match, competitionName));

  const { error } = await supabase.from("matches").upsert(rows, { onConflict: "id" });

  if (error) {
    throw new Error(`Supabase matches upsert failed: ${error.message}`);
  }

  return rows.length;
}

export async function writeToSupabase(entry) {
  if (!supabase) {
    console.warn("Supabase not configured — skipped writing the live table.");
    return;
  }

  const { error } = await supabase
    .from("tournaments")
    .upsert(entryToDbRow(entry), { onConflict: "id" });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

export async function writeToJsonFile(entry, jsonList) {
  const list = jsonList || (await readJsonList());
  const index = list.findIndex((item) => item.championshipId === entry.championshipId);

  if (index >= 0) {
    list[index] = entry;
  } else {
    list.push(entry);
  }

  await fs.writeFile(DATA_PATH, `${JSON.stringify(list, null, 2)}\n`);
  return list;
}

function parseArgs(argv) {
  const [championshipId, ...rest] = argv;
  const flags = {};

  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) {
      const key = rest[i].slice(2);
      const value = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[i + 1] : true;
      flags[key] = value;
      if (value !== true) i++;
    }
  }

  return { championshipId, flags };
}

async function main() {
  const { championshipId, flags } = parseArgs(process.argv.slice(2));

  if (!championshipId) {
    console.error(
      "Usage: node --env-file=.env.local scripts/importTournament.js <championshipId> --tier <S|A|B|C> [--id <slug>] [--location <text>] [--dry-run] [--no-json]"
    );
    process.exit(1);
  }

  const { entry } = await importTournament(championshipId, {
    tier: flags.tier,
    id: flags.id,
    location: flags.location,
  });

  if (flags["dry-run"]) {
    console.log(JSON.stringify(entry, null, 2));
    console.log("\n--dry-run set, not writing anywhere.");
    return;
  }

  await writeToSupabase(entry);
  console.log(`Upserted "${entry.name}" (id: ${entry.id}) into the tournaments table.`);

  if (!flags["no-json"]) {
    await writeToJsonFile(entry);
    console.log(`Also updated tournaments.generated.json.`);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
