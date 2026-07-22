import fs from "node:fs/promises";
import path from "node:path";

import { FaceitStandingsClient } from "./faceitStandingsClient.js";
import { TEST_ENTITIES } from "./standingsEntities.js";

const OUTPUT_DIR = path.resolve("data/v2");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "standings-teams.json");

function parseArgs(argv) {
  const args = {
    entityId: "",
    entityType: "",
    userId: process.env.FACEIT_USER_ID || "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (item === "--entity-id") {
      args.entityId = argv[index + 1] || "";
      index += 1;
    } else if (item === "--entity-type") {
      args.entityType = argv[index + 1] || "";
      index += 1;
    } else if (item === "--user-id") {
      args.userId = argv[index + 1] || "";
      index += 1;
    }
  }

  return args;
}

function normalizeTeam(row, source) {
  return {
    team_id: row.premade_team_id,
    premade_team_id: row.premade_team_id,
    league_team_id: row.league_team_id,
    name: row.name || "",
    nickname: row.nickname || "",
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
      tie_breakers: row.tie_breakers ?? {},
    },
    source: {
      region: source.region ?? null,
      division: source.division ?? null,
      stage: source.stage ?? null,
      conference: source.conference ?? null,
      entity_id: source.entityId,
      entity_type: source.entityType,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const entities = args.entityId
    ? [
        {
          entityId: args.entityId,
          entityType: args.entityType || "conference",
          region: null,
          division: null,
          stage: null,
          conference: null,
        },
      ]
    : TEST_ENTITIES.slice(0, 1);

  const client = new FaceitStandingsClient({
    userId: args.userId,
    limit: 100,
  });

  const byTeamId = new Map();
  const imports = [];

  for (const entity of entities) {
    console.log(
      `Loading ${entity.entityType} ${entity.entityId} (${entity.division || "unknown"} / ${entity.conference || entity.stage || "unknown"})`
    );

    const result = await client.getAll(entity);

    imports.push({
      ...entity,
      tournamentType: result.tournamentType,
      rows: result.standings.length,
    });

    for (const row of result.standings) {
      if (!row.premade_team_id) {
        console.warn("Skipped row without premade_team_id:", row.name);
        continue;
      }

      const team = normalizeTeam(row, entity);
      const existing = byTeamId.get(team.team_id);

      if (!existing) {
        byTeamId.set(team.team_id, team);
      } else {
        existing.sources ??= [existing.source];
        existing.sources.push(team.source);
      }
    }
  }

  const teams = [...byTeamId.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const output = {
    generated_at: new Date().toISOString(),
    importer: "standings-trial-v1",
    imports,
    unique_teams: teams.length,
    teams,
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");

  console.log("");
  console.log(`Imported rows: ${imports.reduce((sum, item) => sum + item.rows, 0)}`);
  console.log(`Unique teams: ${teams.length}`);
  console.log(`Saved: ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error("");
  console.error("Standings trial failed:");
  console.error(error);
  process.exitCode = 1;
});
