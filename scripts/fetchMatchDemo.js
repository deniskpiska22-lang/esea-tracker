// ESEA Tracker — забор demo_urls для одного завершённого матча (job_type
// "demo_sync" в match_stat_jobs, см. 0009_match_demo_sync.sql).
//
// Источник — тот же внутренний FACEIT-эндпоинт team-leagues/v2/matches, что
// уже используется buildDiscoveryUrl() в autoSyncMatches.js для дискавери
// матчей: не требует авторизации, отдаёт по entityId/entityType/status
// список матчей команды, каждый матч включает demo_urls. Здесь — тот же URL
// и заголовки, но по одному конкретному matchId, вызывается консьюмером
// (processMatchStatJobs.js) как отдельный подпроцесс на каждую due-джобу —
// как и autoSyncMatches.js --post-match-only для stats_sync.
//
// НЕ содержит собственной логики бэкоффа/ретраев на уровне джобы — это уже
// делает claim_match_stat_jobs()/processMatchStatJobs.js. Скрипт либо
// проставляет demo_urls (нашёл непустой список), либо тихо завершается без
// записи (матч найден, но демка ещё не готова, или матч пока не найден в
// последних завершённых у обеих команд) — оба случая код 0, следующая
// попытка будет позже по бэкоффу джобы. Ненулевой код — только сетевые/HTTP
// ошибки, которые consumer должен трактовать как retryable.
//
// Запуск: node scripts/fetchMatchDemo.js <matchId>
// (в GitHub Actions/Railway секреты приходят из env; локально —
// node --env-file=.env.local scripts/fetchMatchDemo.js <matchId>)

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { CHAMPIONSHIPS } from "./matchSyncConfig.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are required"
  );
}

const matchId = process.argv[2];

if (!matchId) {
  throw new Error("Usage: node scripts/fetchMatchDemo.js <matchId>");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FETCH_TIMEOUT_MS = Number(
  process.env.DEMO_FETCH_TIMEOUT_MS || 15_000
);

function buildDiscoveryUrl(teamId, status, limit = 10) {
  const params = new URLSearchParams();

  for (const item of CHAMPIONSHIPS) {
    params.append("championship_ids", item.id);
  }

  params.set("entityId", teamId);
  params.set("entityType", "PREMADE_TEAM");
  params.set("status", status);
  params.set("offset", "0");
  params.set("limit", String(limit));

  return (
    "https://www.faceit.com/api/team-leagues/v2/matches?" +
    params.toString()
  );
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 ESEA-Tracker/1.0",
      },
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new Error(
        `${response.status} ${response.statusText}${body ? `: ${body}` : ""}`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function findMatchByTeam(teamId) {
  if (!teamId) {
    return null;
  }

  const data = await fetchJson(
    buildDiscoveryUrl(teamId, "MATCH_STATUS_FINISHED", 10)
  );

  const payload = Array.isArray(data?.payload) ? data.payload : [];

  return payload.find((match) => match?.id === matchId) || null;
}

async function main() {
  const { data: row, error: fetchError } = await supabase
    .from("matches")
    .select("id,team1_id,team2_id")
    .eq("id", matchId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!row) {
    console.log(
      JSON.stringify({ ok: true, matchId, message: "match not found" })
    );
    return;
  }

  const match =
    (await findMatchByTeam(row.team1_id)) ||
    (await findMatchByTeam(row.team2_id));

  if (!match) {
    console.log(
      JSON.stringify({
        ok: true,
        matchId,
        message: "not found in either team's recent finished matches yet",
      })
    );
    return;
  }

  const demoUrls = Array.isArray(match.demo_urls) ? match.demo_urls : [];

  if (demoUrls.length === 0) {
    console.log(
      JSON.stringify({ ok: true, matchId, message: "demo not rendered yet" })
    );
    return;
  }

  const { error: updateError } = await supabase
    .from("matches")
    .update({
      demo_urls: demoUrls,
      demo_synced: true,
      demo_synced_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (updateError) {
    throw updateError;
  }

  console.log(
    JSON.stringify({ ok: true, matchId, demoUrls: demoUrls.length })
  );
}

main().catch((error) => {
  console.error(`[fetch-match-demo] ${matchId} failed:`, error);
  process.exit(1);
});
