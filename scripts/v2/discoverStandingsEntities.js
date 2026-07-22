import fs from "node:fs/promises";
import path from "node:path";
import { SeasonHierarchyClient } from "./seasonHierarchyClient.js";

const ROOT = process.cwd();
const DEFAULT_CONFIG = path.join(ROOT, "scripts/v2/standings.config.json");
const DEFAULT_CACHE = path.join(ROOT, "data/v2/season-hierarchy.json");
const DEFAULT_OUTPUT = path.join(ROOT, "data/v2/standings-entities.json");

const normalize = (value) => String(value || "").trim().toLowerCase();

export function extractStandingsEntities(tree, config) {
  const payload = tree?.payload ?? tree;
  const regions = Array.isArray(payload?.regions) ? payload.regions : [];
  const allowed = new Set((config.divisions || []).map(normalize));
  const entities = [];

  for (const region of regions) {
    for (const division of region.divisions || []) {
      if (!allowed.has(normalize(division.name))) continue;

      for (const stage of division.stages || []) {
        // Team discovery must use the active regular-season table. Playoffs contain
        // only qualified teams and would omit registered 0-match teams.
        if (normalize(stage.name) !== "regular season") continue;
        if (!stage.id) continue;

        entities.push({
          region: region.name || "Unknown",
          regionId: region.id || null,
          division: division.name,
          divisionId: division.id || null,
          stage: stage.name,
          stageId: stage.id,
          conference: null,
          conferences: (stage.conferences || []).map((conference) => ({
            id: conference.id,
            name: conference.name,
            championshipId: conference.championship_id || null,
          })),
          entityId: stage.id,
          entityType: "stage",
        });
      }
    }
  }

  return entities.sort((a, b) =>
    `${a.region}|${a.division}`.localeCompare(`${b.region}|${b.division}`)
  );
}

async function loadConfig(configPath) {
  return JSON.parse(await fs.readFile(configPath, "utf8"));
}

export async function discoverEntities({ configPath = DEFAULT_CONFIG, write = true, refresh = false } = {}) {
  const config = await loadConfig(configPath);
  if (!config.seasonId) throw new Error("standings.config.json must contain seasonId");

  let hierarchy;
  let source;

  if (!refresh) {
    try {
      const cached = JSON.parse(await fs.readFile(DEFAULT_CACHE, "utf8"));
      if ((cached.seasonId || cached.payload?.payload?.season_id || cached.payload?.season_id) === config.seasonId) {
        hierarchy = cached.payload;
        source = cached.source || "data/v2/season-hierarchy.json";
      }
    } catch { /* cache is optional */ }
  }

  if (!hierarchy) {
    const client = new SeasonHierarchyClient();
    const loaded = await client.getSeason(config.seasonId, config.seasonHierarchyUrl || "");
    hierarchy = loaded.payload;
    source = loaded.url;
    await fs.mkdir(path.dirname(DEFAULT_CACHE), { recursive: true });
    await fs.writeFile(DEFAULT_CACHE, JSON.stringify({
      fetched_at: new Date().toISOString(),
      seasonId: config.seasonId,
      source,
      payload: hierarchy,
    }, null, 2) + "\n");
  }

  const entities = extractStandingsEntities(hierarchy, config);
  if (!entities.length) {
    throw new Error(`No Regular Season stages found for: ${config.divisions.join(", ")}`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    season: config.season,
    seasonId: config.seasonId,
    source,
    divisions: config.divisions,
    entities,
  };

  if (write) {
    await fs.mkdir(path.dirname(DEFAULT_OUTPUT), { recursive: true });
    await fs.writeFile(DEFAULT_OUTPUT, JSON.stringify(report, null, 2) + "\n");
  }
  return report;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const refresh = process.argv.includes("--refresh");
  discoverEntities({ refresh }).then((report) => {
    console.table(report.entities.map(({ region, division, stage, conferences }) => ({
      region,
      division,
      stage,
      groups: conferences.map((item) => item.name).join(", "),
      entityType: "stage",
    })));
    console.log(`Found ${report.entities.length} Regular Season stages across ${new Set(report.entities.map((x) => x.region)).size} regions.`);
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}
