import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const CDP_URL = process.env.PLAYWRIGHT_CDP_URL || "http://127.0.0.1:9222";
const BATCH_SIZE = Math.max(1, Number(process.env.STATS_BATCH_SIZE || 50));
const MIN_DELAY_MS = Math.max(0, Number(process.env.STATS_MIN_DELAY_MS || 4000));
const MAX_DELAY_MS = Math.max(MIN_DELAY_MS, Number(process.env.STATS_MAX_DELAY_MS || 8000));
const BATCH_PAUSE_MS = Math.max(0, Number(process.env.STATS_BATCH_PAUSE_MS || 15000));
const MAX_ATTEMPTS = Math.max(1, Number(process.env.STATS_MAX_ATTEMPTS || 5));
const FAILED_FILE = process.env.STATS_FAILED_FILE || "./data/stats-import-failed.json";
const RUN_POST_MATCH_PIPELINE =
  String(process.env.RUN_POST_MATCH_PIPELINE || "1") === "1";

const POST_MATCH_PIPELINE_SCRIPT =
  process.env.POST_MATCH_PIPELINE_SCRIPT ||
  "./scripts/runPostMatchPipeline.js";
const RUN_RATINGS_AFTER_SYNC =
  String(process.env.RUN_RATINGS_AFTER_SYNC || "0") === "1";

const RATINGS_SCRIPT =
  process.env.RATINGS_SCRIPT || "./scripts/recalculateRatings.js";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are required"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = () =>
  MIN_DELAY_MS + Math.random() * Math.max(0, MAX_DELAY_MS - MIN_DELAY_MS);

function numberValue(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") {
      const result = Number(value);
      if (!Number.isNaN(result)) return result;
    }
  }
  return fallback;
}

function normalizePlayer(player = {}) {
  const stats = player.player_stats || player.playerStats || player.stats || player;
  const kills = numberValue(stats, ["Kills", "kills"]);
  const deaths = numberValue(stats, ["Deaths", "deaths"]);
  const headshots = numberValue(stats, ["Headshots", "headshots"]);
  const rawKd = numberValue(stats, ["K/D Ratio", "K/D", "kd"], null);
  const rawHsRate = numberValue(
    stats,
    ["Headshots %", "Headshots%", "HS%", "hsRate", "headshots_percentage"],
    null
  );

  return {
    playerId: player.player_id || player.playerId || player.id || null,
    nickname:
      player.nickname || player.player_name || player.playerName || stats.Nickname || "Unknown",
    kills,
    deaths,
    assists: numberValue(stats, ["Assists", "assists"]),
    adr: numberValue(stats, ["ADR", "adr", "Average Damage per Round"]),
    kd: rawKd ?? (deaths > 0 ? kills / deaths : kills),
    hsRate: rawHsRate ?? (kills > 0 ? (headshots / kills) * 100 : 0),
    kast: numberValue(stats, ["KAST %", "KAST", "kast"]),
    mvps: numberValue(stats, ["MVPs", "MVP", "mvps"]),
  };
}

function normalizeTeam(team = {}) {
  const stats = team.team_stats || team.teamStats || team.stats || team;
  return {
    teamId: team.team_id || team.teamId || stats.TeamId || stats.team_id || null,
    teamName:
      team.team_name || team.teamName || stats.Team || stats.team_name || "Unknown",
    score: numberValue(stats, ["Final Score", "Score", "score", "final_score"]),
    players: (Array.isArray(team.players) ? team.players : []).map(normalizePlayer),
  };
}

function compactStats(body, matchId) {
  const rawMatches = Array.isArray(body) ? body : [body];

  const maps = rawMatches
    .filter((item) => item && typeof item === "object")
    .map((match, index) => {
      const teams = (
        Array.isArray(match.teams)
          ? match.teams
          : []
      ).map(normalizeTeam);

      if (
        teams.length < 2 ||
        teams.some(
          (team) =>
            !Array.isArray(team.players) ||
            team.players.length === 0,
        )
      ) {
        return null;
      }

      const mapName =
        match.map ||
        match.map_name ||
        match.mapName ||
        match.stats?.Map ||
        match.stats?.map ||
        `Map ${index + 1}`;

      return {
        map: mapName,
        teams,
      };
    })
    .filter(Boolean);

  if (maps.length === 0) {
    return null;
  }

  /*
   * Общая статистика игроков за матч.
   * Если FACEIT вернул несколько карт,
   * показатели суммируются по playerId.
   */
  const aggregate = new Map();

  for (const map of maps) {
    for (const team of map.teams) {
      for (const player of team.players) {
        const key =
          player.playerId ||
          `${team.teamId || team.teamName}:${player.nickname}`;

        const current =
          aggregate.get(key) || {
            playerId: player.playerId,
            nickname: player.nickname,
            teamId: team.teamId,
            teamName: team.teamName,
            kills: 0,
            deaths: 0,
            assists: 0,
            adrTotal: 0,
            adrMaps: 0,
            hsKills: 0,
            kastTotal: 0,
            kastMaps: 0,
            mvps: 0,
          };

        current.kills += Number(player.kills || 0);
        current.deaths += Number(player.deaths || 0);
        current.assists += Number(player.assists || 0);
        current.mvps += Number(player.mvps || 0);

        if (Number.isFinite(Number(player.adr))) {
          current.adrTotal += Number(player.adr);
          current.adrMaps += 1;
        }

        if (Number.isFinite(Number(player.hsRate))) {
          current.hsKills +=
            Number(player.kills || 0) *
            (Number(player.hsRate) / 100);
        }

        if (Number.isFinite(Number(player.kast))) {
          current.kastTotal += Number(player.kast);
          current.kastMaps += 1;
        }

        aggregate.set(key, current);
      }
    }
  }

  const players = [...aggregate.values()].map(
    (player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      teamId: player.teamId,
      teamName: player.teamName,
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      adr:
        player.adrMaps > 0
          ? player.adrTotal / player.adrMaps
          : 0,
      kd:
        player.deaths > 0
          ? player.kills / player.deaths
          : player.kills,
      hsRate:
        player.kills > 0
          ? (player.hsKills / player.kills) * 100
          : 0,
      kast:
        player.kastMaps > 0
          ? player.kastTotal / player.kastMaps
          : 0,
      mvps: player.mvps,
    }),
  );

  return {
    matchId,
    maps,
    players,
  };
}

async function readFailedState() {
  try {
    const raw = await fs.readFile(FAILED_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeFailedState(state) {
  const directory = FAILED_FILE.replace(/[\\/][^\\/]+$/, "");
  if (directory && directory !== FAILED_FILE) {
    await fs.mkdir(directory, { recursive: true });
  }
  await fs.writeFile(FAILED_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function countRemaining() {
  const { count, error } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .in("status", ["FINISHED", "MATCH_STATUS_FINISHED"])
    .or("stats_synced.eq.false,stats_synced.is.null,player_stats.is.null");

  if (error) throw error;
  return count || 0;
}

async function loadAllCandidates(excludedIds) {
  const pageSize = 1000;
  const result = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("matches")
      .select("id,map_scores,player_stats,stats_synced,finished_at")
      .in("status", ["FINISHED", "MATCH_STATUS_FINISHED"])
      .or("stats_synced.eq.false,stats_synced.is.null,player_stats.is.null")
      .order("finished_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = data || [];
    for (const match of rows) {
      if (!excludedIds.has(match.id)) result.push(match);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return result;
}

async function fetchStats(page, matchId) {
  return page.evaluate(async (id) => {
    const response = await fetch(`https://www.faceit.com/api/stats/v3/matches/${id}`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });

    let body = null;
    try {
      body = await response.json();
    } catch {}

    return { status: response.status, body };
  }, matchId);
}

function buildMapScores(statsPayload) {
  return statsPayload.maps.map((map) => {
    const firstTeam = map.teams[0];
    const secondTeam = map.teams[1];

    return {
      map: map.map,
      team1: {
        teamId: firstTeam.teamId,
        teamName: firstTeam.teamName,
        score: Number(firstTeam.score || 0),
      },
      team2: {
        teamId: secondTeam.teamId,
        teamName: secondTeam.teamName,
        score: Number(secondTeam.score || 0),
      },
    };
  });
}

async function saveMatchStats(match, statsPayload) {
  const now = new Date().toISOString();
  const mapScores = buildMapScores(statsPayload);

  if (
    !Array.isArray(mapScores) ||
    mapScores.length === 0 ||
    !Array.isArray(statsPayload.players) ||
    statsPayload.players.length === 0
  ) {
    throw new Error(
      "FACEIT returned incomplete maps or player statistics",
    );
  }

  const updatePayload = {
    map_scores: mapScores,
    player_stats: statsPayload,
    stats_synced: true,
    stats_synced_at: now,
    updated_at: now,
  };

  const { error } = await supabase
    .from("matches")
    .update(updatePayload)
    .eq("id", match.id);

  if (error) throw error;
}


async function runRatingsRecalculation() {
  if (!RUN_RATINGS_AFTER_SYNC) {
    return;
  }

  try {
    await fs.access(RATINGS_SCRIPT);
  } catch {
    console.warn(
      `Ratings script not found: ${RATINGS_SCRIPT}. Skipping.`,
    );
    return;
  }

  console.log(
    `Running rating recalculation: ${RATINGS_SCRIPT} --apply`,
  );

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--env-file=.env.local", RATINGS_SCRIPT, "--apply"],
      {
        stdio: "inherit",
        shell: false,
      },
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Rating recalculation exited with code ${code}`,
          ),
        );
      }
    });
  });
}


async function runPostMatchPipeline() {
  if (!RUN_POST_MATCH_PIPELINE) {
    return;
  }

  console.log(
    `Running post-match pipeline: ${POST_MATCH_PIPELINE_SCRIPT}`,
  );

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--env-file=.env.local",
        POST_MATCH_PIPELINE_SCRIPT,
      ],
      {
        stdio: "inherit",
        shell: false,
      },
    );

    child.on("error", reject);

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Post-match pipeline exited with code ${code}`,
          ),
        );
      }
    });
  });
}

async function main() {
  const failedState = await readFailedState();

  // Все уже известные ошибки пропускаются. Поэтому один и тот же 404
  // не возвращается в начало очереди при каждом новом пакете.
  const excludedIds = new Set(Object.keys(failedState));

  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages().find((item) => item.url().includes("faceit.com"));

  if (!page) {
    throw new Error(
      "Open FACEIT in Edge first, log in, and keep a FACEIT tab open with remote debugging enabled"
    );
  }

  const databaseRemaining = await countRemaining();
  const queue = await loadAllCandidates(excludedIds);

  console.log(`Database without stats: ${databaseRemaining}`);
  console.log(`Previously skipped: ${excludedIds.size}`);
  console.log(`Queue for this run: ${queue.length}`);

  let totalSynced = 0;
  let totalFailed = 0;

  for (let offset = 0; offset < queue.length; offset += BATCH_SIZE) {
    const candidates = queue.slice(offset, offset + BATCH_SIZE);
    const batchNumber = Math.floor(offset / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(queue.length / BATCH_SIZE);

    console.log(`\nBATCH ${batchNumber}/${totalBatches}: ${candidates.length} matches`);

    for (let index = 0; index < candidates.length; index += 1) {
      const match = candidates[index];
      let finished = false;
      let attempt = 0;

      while (!finished && attempt < MAX_ATTEMPTS) {
        attempt += 1;

        try {
          const result = await fetchStats(page, match.id);

          // Все 404 считаются постоянными и записываются в failed-файл.
          // Они автоматически пропускаются при следующих запусках.
          if (result.status === 404) {
            failedState[match.id] = {
              attempts: attempt,
              permanent: true,
              status: 404,
              lastError: "FACEIT stats status 404",
              lastAttemptAt: new Date().toISOString(),
            };
            totalFailed += 1;
            console.error(
              `SKIP 404 ${match.id} (${index + 1}/${candidates.length})`
            );
            await writeFailedState(failedState);
            finished = true;
            continue;
          }

          /*
           * При 403/429 ничего не ждём и не повторяем запрос.
           * Матч пропускается только в текущем запуске.
           * В failed-файл он не добавляется, поэтому его можно
           * попробовать снова при следующем запуске скрипта.
           */
          if (result.status === 403 || result.status === 429) {
            totalFailed += 1;
            finished = true;

            console.error(
              `SKIP LIMIT ${result.status} ${match.id} ` +
                `(${index + 1}/${candidates.length}); no retry, no pause`,
            );

            continue;
          }

          if (result.status !== 200 || !result.body) {
            throw new Error(`FACEIT stats status ${result.status}`);
          }

          const statsPayload = compactStats(result.body, match.id);
          if (!statsPayload) {
            throw new Error("Map or player statistics are empty or incomplete");
          }

          await saveMatchStats(match, statsPayload);
          delete failedState[match.id];
          totalSynced += 1;
          finished = true;

          console.log(
            `SAVED ${match.id} (${index + 1}/${candidates.length}); session total=${totalSynced}`
          );
          await sleep(randomDelay());
        } catch (error) {
          if (attempt >= MAX_ATTEMPTS) {
            failedState[match.id] = {
              attempts: attempt,
              permanent: false,
              lastError: error.message,
              lastAttemptAt: new Date().toISOString(),
            };
            totalFailed += 1;
            finished = true;
            console.error(
              `SKIP ERROR ${match.id}: ${error.message}; attempts ${attempt}/${MAX_ATTEMPTS}`
            );
            await writeFailedState(failedState);
          } else {
            console.error(
              `RETRY ${match.id}: ${error.message}; attempt ${attempt}/${MAX_ATTEMPTS}`
            );
            await sleep(Math.max(10000, randomDelay()));
          }
        }
      }
    }

    await writeFailedState(failedState);

    if (offset + BATCH_SIZE < queue.length) {
      console.log(`Batch completed. Sleeping ${Math.round(BATCH_PAUSE_MS / 1000)} sec...`);
      await sleep(BATCH_PAUSE_MS);
    }
  }

  const remaining = await countRemaining();
  console.log("\n==================================================");
  console.log("CURRENT QUEUE COMPLETED");
  console.log(
    JSON.stringify(
      {
        totalQueued: queue.length,
        totalSynced,
        totalSkipped: totalFailed,
        databaseRemaining: remaining,
        failedFile: FAILED_FILE,
        ratingsRecalculated:
          totalSynced > 0 && RUN_RATINGS_AFTER_SYNC,
      },
      null,
      2
    )
  );
  console.log(
    "Known 404 and exhausted ordinary errors are excluded on the next run. " +
      "403/429 matches are skipped without waiting and can be retried on the next run."
  );

  if (totalSynced > 0) {
    await runRatingsRecalculation();
  }

  if (totalSynced > 0) {
    await runPostMatchPipeline();
  }

  await browser.close().catch(() => {});
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exitCode = 1;
});
