import fs from "node:fs/promises";
import path from "node:path";
import seedTeams from "../../src/data/teams.js";
import { FaceitClient } from "./faceitClient.js";
import { championships, findChampionship } from "./championships.js";

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function determineCountry(players) {
  const counts = new Map();
  for (const player of players) {
    const country = player.country?.toUpperCase();
    if (!country) continue;
    counts.set(country, (counts.get(country) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [country, count] = sorted[0] ?? [];
  return count >= 3 ? country : "INT";
}

function extractTeamsFromMatches(matches) {
  const teams = new Map();

  for (const match of matches) {
    for (const faction of match.factions ?? []) {
      const id = faction?.premade_team_id;
      if (!id) continue;

      teams.set(id, {
        id,
        name: faction.name ?? "Unknown",
        avatar: faction.avatar ?? null,
      });
    }
  }

  return teams;
}

function uniqueMatches(matches) {
  const byId = new Map();
  for (const match of matches) {
    if (match?.id) byId.set(match.id, match);
  }
  return [...byId.values()];
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { error: error.message, item: items[index] };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run)
  );
  return results;
}

async function main() {
  const requested = readArg("championship", championships[0].id);
  const championship = findChampionship(requested);
  if (!championship) {
    throw new Error(`Unknown championship: ${requested}`);
  }

  const maxMatches = Number(readArg("max-matches", "10000"));
  const maxTeams = Number(readArg("max-teams", "10000"));
  const maxSeeds = Number(readArg("max-seeds", "10000"));
  const includePlayers = readArg("players", "true") !== "false";
  const includeProfiles = readArg("profiles", "true") !== "false";
  const client = new FaceitClient();

  const seeds = seedTeams
    .filter((team) => team.faceitTeamId)
    .slice(0, maxSeeds);

  console.log("\nESEA Tracker 2.0 discovery");
  console.log(`Championship: ${championship.name}`);
  console.log(`ID: ${championship.id}`);
  console.log(`Seed teams: ${seeds.length}\n`);

  const seedResults = await mapWithConcurrency(seeds, 2, async (team) => {
    const matches = await client.getTeamLeagueMatches({
      teamId: team.faceitTeamId,
      championshipIds: [championship.id],
      maxItems: maxMatches,
    });

    console.log(`${team.name}: ${matches.length} matches`);
    return { teamId: team.faceitTeamId, teamName: team.name, matches };
  });

  const failedSeeds = seedResults.filter((result) => result?.error);
  const matches = uniqueMatches(
    seedResults.flatMap((result) => result?.matches ?? [])
  ).slice(0, maxMatches);

  const discoveredTeams = extractTeamsFromMatches(matches);
  const discoveredTeamSeeds = [...discoveredTeams.values()].slice(0, maxTeams);

  let teamRows;
  if (!includeProfiles) {
    teamRows = discoveredTeamSeeds.map((team) => ({
      ...team,
      country: "INT",
      rosterIds: [],
      players: [],
    }));
  } else {
    teamRows = await mapWithConcurrency(discoveredTeamSeeds, 3, async (seed) => {
      const team = await client.getTeam(seed.id);
      const rosterIds = [
        ...new Set((team.members ?? []).map((member) => member.user_id)),
      ];

      let players = [];
      if (includePlayers) {
        const loaded = await mapWithConcurrency(rosterIds, 3, async (playerId) => {
          const player = await client.getPlayer(playerId);
          return {
            id: player.player_id,
            nickname: player.nickname,
            country: player.country ?? null,
            avatar: player.avatar ?? null,
          };
        });
        players = loaded.filter((item) => item && !item.error);
      }

      return {
        id: seed.id,
        name: team.name ?? seed.name,
        nickname: team.nickname ?? null,
        avatar: team.avatar ?? seed.avatar,
        country: determineCountry(players),
        rosterIds,
        players,
      };
    });
  }

  const teams = teamRows.filter((item) => item && !item.error);
  const failedTeams = teamRows.filter((item) => item?.error);
  const players = teams.flatMap((team) => team.players ?? []);
  const missingCountryPlayers = players.filter((player) => !player.country);

  const report = {
    generatedAt: new Date().toISOString(),
    config: championship,
    source: {
      endpoint: "https://www.faceit.com/api/team-leagues/v2/matches",
      strategy:
        "Use existing teams.js as seeds, fetch championship matches, then discover every faction team_id.",
    },
    summary: {
      seedTeams: seeds.length,
      failedSeeds: failedSeeds.length,
      matches: matches.length,
      uniqueTeams: discoveredTeams.size,
      loadedTeams: teams.length,
      failedTeams: failedTeams.length,
      loadedPlayers: players.length,
      playersWithoutCountry: missingCountryPlayers.length,
    },
    teams,
    failedTeams,
    failedSeeds,
    matches,
  };

  const outputDir = path.resolve("data/v2/discovery");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${championship.id}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.table(report.summary);
  console.log(`\nSaved: ${outputPath}`);

  if (matches.length === 0) {
    console.log(
      "\nNo matches found. Increase --max-seeds or make sure teams.js contains at least one team from this championship."
    );
  }
}

main().catch((error) => {
  console.error(`\nDiscovery failed: ${error.message}`);
  process.exitCode = 1;
});
