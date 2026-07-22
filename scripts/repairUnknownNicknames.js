import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;
const faceitApiKey = process.env.FACEIT_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "(or SUPABASE_SECRET_KEY) are required"
  );
}

if (!faceitApiKey) {
  throw new Error("FACEIT_API_KEY is required");
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const CONCURRENCY = Math.max(
  1,
  Number(
    process.env.REPAIR_NICKNAME_CONCURRENCY || 4
  )
);

const REQUEST_DELAY_MS = Math.max(
  0,
  Number(
    process.env.REPAIR_NICKNAME_DELAY_MS || 250
  )
);

const FETCH_TIMEOUT_MS = Math.max(
  5000,
  Number(
    process.env.FACEIT_FETCH_TIMEOUT_MS || 20000
  )
);

const FAILED_FILE =
  process.env.REPAIR_NICKNAME_FAILED_FILE ||
  "./data/repair-unknown-nicknames-failed.json";

const sleep = (milliseconds) =>
  new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );

function isValidNickname(value) {
  const nickname = String(value || "").trim();

  return (
    Boolean(nickname) &&
    nickname.toLowerCase() !== "unknown"
  );
}

function formatError(error) {
  return [
    error?.name,
    error?.message,
    error?.cause?.code,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function fetchFaceitPlayer(
  faceitId,
  attempts = 4
) {
  const url =
    `https://open.faceit.com/data/v4/players/${encodeURIComponent(
      faceitId
    )}`;

  let lastError = null;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt += 1
  ) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS
    );

    try {
      const response = await fetch(url, {
        headers: {
          Authorization:
            `Bearer ${faceitApiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (response.ok) {
        return await response.json();
      }

      const body = (
        await response.text()
      ).slice(0, 300);

      const error = new Error(
        `${response.status} ${response.statusText}` +
          (body ? `: ${body}` : "")
      );

      error.status = response.status;

      if (
        response.status === 404 ||
        (
          response.status < 500 &&
          response.status !== 408 &&
          response.status !== 429
        )
      ) {
        throw error;
      }

      lastError = error;
    } catch (error) {
      lastError = error;

      const retryable =
        error?.name === "AbortError" ||
        error?.message === "fetch failed" ||
        error?.status === 408 ||
        error?.status === 429 ||
        Number(error?.status) >= 500;

      if (
        !retryable ||
        attempt === attempts
      ) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(
      Math.min(
        10000,
        750 * 2 ** (attempt - 1)
      )
    );
  }

  throw lastError ||
    new Error("FACEIT request failed");
}

async function loadUnknownPlayers() {
  const rows = [];
  let cursor = null;

  while (true) {
    let query = supabase
      .from("players")
      .select("id,faceit_id,nickname")
      .ilike("nickname", "unknown")
      .not("faceit_id", "is", null)
      .order("id", {
        ascending: true,
      })
      .limit(500);

    if (cursor) {
      query = query.gt("id", cursor);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Unable to load Unknown players: ${error.message}`
      );
    }

    const batch = data || [];

    rows.push(...batch);

    if (batch.length < 500) {
      break;
    }

    cursor =
      batch[batch.length - 1].id;
  }

  return rows;
}

async function repairPlayer(player) {
  const profile =
    await fetchFaceitPlayer(
      player.faceit_id
    );

  const nickname =
    String(
      profile?.nickname || ""
    ).trim();

  if (!isValidNickname(nickname)) {
    return {
      status: "skipped",
      id: player.id,
      faceitId: player.faceit_id,
      reason:
        "FACEIT returned no valid nickname",
    };
  }

  const { error } = await supabase
    .from("players")
    .update({
      nickname,
      avatar:
        profile?.avatar || undefined,
      country:
        profile?.country || undefined,
      faceit_elo:
        profile?.games?.cs2?.faceit_elo ??
        profile?.games?.csgo?.faceit_elo ??
        undefined,
      faceit_level:
        profile?.games?.cs2?.skill_level ??
        profile?.games?.csgo?.skill_level ??
        undefined,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", player.id);

  if (error) {
    throw new Error(
      `Supabase update failed: ${error.message}`
    );
  }

  return {
    status: "recovered",
    id: player.id,
    faceitId: player.faceit_id,
    nickname,
  };
}

async function runPool(
  items,
  worker,
  size
) {
  let cursor = 0;

  const workers = Array.from(
    {
      length: Math.min(
        size,
        Math.max(items.length, 1)
      ),
    },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(
          items[index],
          index
        );
      }
    }
  );

  await Promise.all(workers);
}

async function main() {
  const players =
    await loadUnknownPlayers();

  console.log(
    `Unknown players found: ${players.length}`
  );

  if (!players.length) {
    return;
  }

  let recovered = 0;
  let skipped = 0;
  let failed = 0;

  const failures = [];

  await runPool(
    players,
    async (player, index) => {
      try {
        if (REQUEST_DELAY_MS > 0) {
          await sleep(
            REQUEST_DELAY_MS +
              Math.floor(
                Math.random() * 150
              )
          );
        }

        const result =
          await repairPlayer(player);

        if (
          result.status === "recovered"
        ) {
          recovered += 1;
          console.log(
            `[${index + 1}/${players.length}] ` +
              `${player.faceit_id} -> ${result.nickname}`
          );
        } else {
          skipped += 1;
          failures.push(result);

          console.warn(
            `[${index + 1}/${players.length}] ` +
              `SKIPPED ${player.faceit_id}: ` +
              result.reason
          );
        }
      } catch (error) {
        failed += 1;

        const failure = {
          status: "failed",
          id: player.id,
          faceitId:
            player.faceit_id,
          error:
            formatError(error),
        };

        failures.push(failure);

        console.warn(
          `[${index + 1}/${players.length}] ` +
            `FAILED ${player.faceit_id}: ` +
            failure.error
        );
      }
    },
    CONCURRENCY
  );

  await writeFile(
    FAILED_FILE,
    JSON.stringify(
      {
        generatedAt:
          new Date().toISOString(),
        total: players.length,
        recovered,
        skipped,
        failed,
        items: failures,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("\nRepair completed");
  console.log({
    total: players.length,
    recovered,
    skipped,
    failed,
    failedFile: FAILED_FILE,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
