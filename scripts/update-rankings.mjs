import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const teamsPath = path.join(projectRoot, "src", "data", "teams.js");
const historyPath = path.join(projectRoot, "src", "data", "teamHistory.json");
const snapshotPath = path.join(
  projectRoot,
  "src",
  "data",
  "rankingSnapshot.json"
);

function getArgument(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((item) => item.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

function getDate() {
  const customDate = getArgument("date");

  if (customDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customDate)) {
      throw new Error("Дата должна быть в формате YYYY-MM-DD");
    }

    return customDate;
  }

  return new Date().toISOString().slice(0, 10);
}

function sortTeams(teams) {
  return [...teams].sort((a, b) => {
    const pointsDifference = Number(b.points) - Number(a.points);

    if (pointsDifference !== 0) return pointsDifference;

    return String(a.name).localeCompare(String(b.name), "ru");
  });
}

function getPreviousPoint(historyEntries, currentPoints) {
  if (!Array.isArray(historyEntries) || historyEntries.length === 0) {
    return currentPoints;
  }

  return Number(historyEntries.at(-1)?.rating) || currentPoints;
}

async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function main() {
  const date = getDate();
  const force = process.argv.includes("--force");

  const importUrl = `${pathToFileURL(teamsPath).href}?updated=${Date.now()}`;
  const imported = await import(importUrl);
  const teams = imported.default;

  if (!Array.isArray(teams)) {
    throw new Error("src/data/teams.js должен экспортировать массив по умолчанию");
  }

  const normalizedTeams = teams.map((team) => {
    const points = Number(team.points);

    if (!team.slug || !team.name) {
      throw new Error("У каждой команды должны быть slug и name");
    }

    if (!Number.isFinite(points)) {
      throw new Error(`У команды ${team.name} отсутствует корректное поле points`);
    }

    return {
      slug: team.slug,
      name: team.name,
      points,
    };
  });

  const history = await readJson(historyPath, {});

  const previousPointsBySlug = Object.fromEntries(
    normalizedTeams.map((team) => [
      team.slug,
      getPreviousPoint(history[team.slug], team.points),
    ])
  );

  const previousRanking = sortTeams(
    normalizedTeams.map((team) => ({
      ...team,
      points: previousPointsBySlug[team.slug],
    }))
  );

  const previousRankBySlug = Object.fromEntries(
    previousRanking.map((team, index) => [team.slug, index + 1])
  );

  const currentRanking = sortTeams(normalizedTeams);

  const snapshot = currentRanking.map((team, index) => {
    const rank = index + 1;
    const previousRank = previousRankBySlug[team.slug] ?? rank;
    const previousPoints = previousPointsBySlug[team.slug] ?? team.points;

    return {
      slug: team.slug,
      name: team.name,
      rank,
      previousRank,
      rankChange: previousRank - rank,
      points: team.points,
      previousPoints,
      pointsChange: team.points - previousPoints,
      updatedAt: date,
    };
  });

  for (const team of currentRanking) {
    const entries = Array.isArray(history[team.slug])
      ? [...history[team.slug]]
      : [];

    const existingIndex = entries.findIndex((entry) => entry.week === date);

    if (existingIndex >= 0) {
      if (!force) {
        entries[existingIndex] = {
          ...entries[existingIndex],
          rating: team.points,
        };
      } else {
        entries[existingIndex] = {
          week: date,
          rating: team.points,
        };
      }
    } else {
      entries.push({
        week: date,
        rating: team.points,
      });
    }

    entries.sort((a, b) => String(a.week).localeCompare(String(b.week)));
    history[team.slug] = entries;
  }

  await fs.writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`);
  await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

  console.log(`Рейтинг обновлён на ${date}.`);
  console.log(`Команд: ${snapshot.length}`);
  console.log("Созданы/обновлены:");
  console.log("- src/data/teamHistory.json");
  console.log("- src/data/rankingSnapshot.json");
}

main().catch((error) => {
  console.error("\nОшибка обновления рейтинга:");
  console.error(error.message);
  process.exitCode = 1;
});
