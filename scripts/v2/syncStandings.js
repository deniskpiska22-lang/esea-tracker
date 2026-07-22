import fs from "node:fs/promises";
import path from "node:path";
import { FaceitStandingsClient } from "./faceitStandingsClient.js";
import { FaceitClient } from "./faceitClient.js";
import { discoverEntities } from "./discoverStandingsEntities.js";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "scripts/v2/standings.config.json");
const JSON_OUTPUT = path.join(ROOT, "data/v2/standings-teams.json");
const JS_OUTPUT = path.join(ROOT, "src/data/teams.generated.js");

function slugify(value) {
  return String(value || "team")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "team";
}

function parseArgs(argv) {
  const result = { profiles: false, players: false, all: false };
  for (const arg of argv) {
    if (arg === "--profiles") result.profiles = true;
    if (arg === "--players") { result.profiles = true; result.players = true; }
    if (arg === "--all") result.all = true;
  }
  return result;
}

function majorityCountry(players, fallback) {
  const counts = new Map();
  for (const player of players) {
    const code = player.country?.toUpperCase();
    if (code) counts.set(code, (counts.get(code) || 0) + 1);
  }
  const winner = [...counts.entries()].sort((a,b) => b[1]-a[1])[0];
  return winner?.[1] >= 3 ? winner[0] : (fallback || "INT");
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      try { out[i] = await worker(items[i], i); }
      catch (error) { out[i] = { ...items[i], import_error: error.message }; }
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, run));
  return out;
}

function normalizeStanding(row, source) {
  return {
    team_id: row.premade_team_id,
    premade_team_id: row.premade_team_id,
    league_team_id: row.league_team_id || null,
    name: row.name || row.nickname || "Unknown",
    nickname: row.nickname || null,
    avatar_url: row.avatar_url || "",
    country_code: row.country_code || null,
    user_count: row.user_count ?? null,
    user_paid_count: row.user_paid_count ?? null,
    is_disqualified: Boolean(row.is_disqualified),
    standings: {
      rank_start: row.rank_start ?? null,
      rank_end: row.rank_end ?? null,
      points: row.points ?? 0,
      won: row.won ?? 0,
      tied: row.tied ?? 0,
      lost: row.lost ?? 0,
      matches: row.matches ?? 0,
      buchholz_score: row.buchholz_score ?? 0,
      tie_breakers: row.tie_breakers || {},
    },
    sources: [source],
    players: [],
  };
}

function mergeStanding(existing, incoming) {
  existing.sources.push(...incoming.sources);
  if (!existing.avatar_url && incoming.avatar_url) existing.avatar_url = incoming.avatar_url;
  if (!existing.country_code && incoming.country_code) existing.country_code = incoming.country_code;
  return existing;
}

function toRuntimeTeam(team, season) {
  const source = team.sources[0] || {};
  return {
    slug: `${slugify(team.name)}-${team.team_id.slice(0, 8)}`,
    name: team.name,
    faceitTeamId: team.team_id,
    leagueTeamId: team.league_team_id,
    logo: team.avatar_url || "/logos/faceit-logo.png",
    flag: null,
    country: team.country_code || "INT",
    division: source.division || "Unknown",
    conference: source.conference || null,
    season,
    points: team.standings.points || 0,
    stats: { wins: team.standings.won || 0, losses: team.standings.lost || 0 },
    players: (team.players || []).map((p) => p.nickname).filter(Boolean),
    playerIds: (team.players || []).map((p) => p.id).filter(Boolean),
    matches: [],
    standings: team.standings,
    sources: team.sources,
    generated: true,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
  const discovery = await discoverEntities({ configPath: CONFIG_PATH });
  const entities = discovery.entities;
  if (!entities.length) throw new Error("No Entry/Intermediate/Main/Advanced standings entities discovered");

  const standingsClient = new FaceitStandingsClient({
    userId: process.env.FACEIT_USER_ID || "",
    limit: 100,
  });
  const byId = new Map();
  const imports = [];

  for (const entity of entities) {
    console.log(`Standings: ${entity.division} ${entity.conference || entity.stage} (${entity.entityType})`);
    const result = await standingsClient.getAll(entity);
    imports.push({ ...entity, rows: result.standings.length, tournamentType: result.tournamentType });
    for (const row of result.standings) {
      if (!row.premade_team_id) continue;
      const source = {
        season: config.season,
        region: entity.region || null,
        division: entity.division || null,
        stage: entity.stage || null,
        conference: entity.conference || null,
        entity_id: entity.entityId,
        entity_type: entity.entityType,
      };
      const incoming = normalizeStanding(row, source);
      const current = byId.get(incoming.team_id);
      byId.set(incoming.team_id, current ? mergeStanding(current, incoming) : incoming);
    }
  }

  let teams = [...byId.values()];
  if (args.profiles) {
    const api = new FaceitClient();
    teams = await mapLimit(teams, 3, async (team) => {
      const profile = await api.getTeam(team.team_id);
      const rosterIds = [...new Set((profile.members || []).map((m) => m.user_id).filter(Boolean))];
      let players = [];
      if (args.players) {
        const loaded = await mapLimit(rosterIds, 3, async (id) => {
          const p = await api.getPlayer(id);
          return { id: p.player_id, nickname: p.nickname, country: p.country || null, avatar: p.avatar || null };
        });
        players = loaded.filter((p) => !p.import_error);
      }
      return {
        ...team,
        name: profile.name || team.name,
        nickname: profile.nickname || team.nickname,
        avatar_url: profile.avatar || team.avatar_url,
        roster_ids: rosterIds,
        players,
        country_code: majorityCountry(players, team.country_code),
      };
    });
  }

  teams.sort((a,b) => a.name.localeCompare(b.name));
  const report = {
    generated_at: new Date().toISOString(),
    importer: "standings-auto-v2",
    season: config.season,
    imports,
    unique_teams: teams.length,
    teams,
  };
  const runtimeTeams = teams.map((team) => toRuntimeTeam(team, config.season));
  const moduleText = `// AUTO-GENERATED by scripts/v2/syncStandings.js\n// Do not edit manually. Divisions and season are configured in scripts/v2/standings.config.json.\n\nconst teams = ${JSON.stringify(runtimeTeams, null, 2)};\n\nexport default teams;\n`;

  await fs.mkdir(path.dirname(JSON_OUTPUT), { recursive: true });
  await fs.writeFile(JSON_OUTPUT, JSON.stringify(report, null, 2) + "\n", "utf8");
  await fs.writeFile(JS_OUTPUT, moduleText, "utf8");
  console.log(`Saved ${teams.length} teams to ${path.relative(ROOT, JS_OUTPUT)}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
