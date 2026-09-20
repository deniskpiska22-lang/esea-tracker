import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

import teams from "../src/data/teams.generated.js";
import playerAliases from "../src/data/playerAliases.js";
import {
  getPlayerSeoMetadata,
  isFaceitPlayerId,
} from "../src/utils/playerSeo.js";

const SITE_ORIGIN = "https://eseatracker.ru";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const distDirectory = path.join(projectRoot, "dist");
const teamsDirectory = path.join(distDirectory, "teams");
const playersDirectory = path.join(distDirectory, "players");
const templatePath = path.join(distDirectory, "index.html");
const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 250;

const staticPages = [
  "",
  "/rankings",
  "/matches",
  "/players",
  "/calendar",
  "/about",
  "/media",
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function replaceMeta(html, team) {
  const canonicalUrl = `${SITE_ORIGIN}/teams/${encodeURIComponent(team.slug)}`;
  const title = `${team.name}: матчи, состав, статистика и рейтинг CS2 | ESEA Tracker`;
  const details = [
    team.division ? `${team.division} Division` : null,
    team.country || null,
    team.season ? `сезон ${team.season}` : null,
  ].filter(Boolean);
  const detailText = details.length > 0 ? ` ${details.join(", ")}.` : "";
  const description = `${team.name} — матчи, результаты, состав, статистика игроков и рейтинг команды ESEA CS2.${detailText}`;
  const image = team.logo || `${SITE_ORIGIN}/logo.png`;
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: team.name,
    sport: "Counter-Strike 2",
    url: canonicalUrl,
    logo: image,
    description,
  }).replaceAll("<", "\\u003c");
  const initialContent = `
    <main style="min-height:100vh;background:#05070a;color:#fff;font-family:Arial,sans-serif;padding:48px 24px">
      <article style="max-width:900px;margin:0 auto">
        <p style="color:#f97316;font-weight:700">ESEA Tracker</p>
        <h1>${escapeHtml(team.name)} — команда ESEA CS2</h1>
        <p>${escapeHtml(description)}</p>
        <p><a href="/rankings" style="color:#fb923c">Рейтинг команд</a> · <a href="/matches" style="color:#fb923c">Матчи ESEA CS2</a></p>
      </article>
    </main>`;

  return html
    .replace(/<html\b[^>]*>/i, '<html lang="ru">')
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(description)}" />`
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${escapeHtml(title)}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${escapeHtml(description)}" />`
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
    )
    .replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:image" content="${escapeHtml(image)}" />`
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`
    )
    .replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
      `<script type="application/ld+json">${structuredData}</script>`
    )
    .replace('<div id="root"></div>', `<div id="root">${initialContent}</div>`);
}

async function fetchAllRows(client, table, columns, configure = (query) => query) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const query = configure(
      client.from(table).select(columns).range(from, from + PAGE_SIZE - 1)
    );
    const { data, error } = await query;

    if (error) {
      throw new Error(`[seo] ${table} query failed: ${error.message}`);
    }

    rows.push(...(data || []));

    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

async function loadPlayersForSeo() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn("[seo] Supabase build variables are missing; player pages were skipped");
    return [];
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [ratings, identities, teamLinks, ratingTeams] = await Promise.all([
    fetchAllRows(
      client,
      "player_ratings",
      "player_id,nickname,rating,recent_rating,matches_played,maps_played,adr,kd,last_match_at"
    ),
    fetchAllRows(
      client,
      "players",
      "id,faceit_id,nickname,avatar,country,faceit_elo,faceit_level,updated_at"
    ),
    fetchAllRows(
      client,
      "team_players",
      "team_id,player_id,is_active,joined_at",
      (query) => query.eq("is_active", true)
    ),
    fetchAllRows(client, "team_ratings", "team_id,team_name"),
  ]);

  const identityByFaceitId = new Map(
    identities.map((player) => [String(player.faceit_id), player])
  );
  const faceitIdByDatabaseId = new Map(
    identities.map((player) => [String(player.id), String(player.faceit_id)])
  );
  const teamNameById = new Map(
    ratingTeams
      .filter((team) => team?.team_id && team?.team_name)
      .map((team) => [String(team.team_id), String(team.team_name)])
  );
  const latestTeamByFaceitId = new Map();

  for (const link of teamLinks) {
    const faceitId = faceitIdByDatabaseId.get(String(link.player_id));
    const teamName = teamNameById.get(String(link.team_id));
    if (!faceitId || !teamName) continue;

    const current = latestTeamByFaceitId.get(faceitId);
    const joinedAt = new Date(link.joined_at || 0).getTime();
    if (!current || joinedAt >= current.joinedAt) {
      latestTeamByFaceitId.set(faceitId, { teamName, joinedAt });
    }
  }

  return ratings
    .map((rating) => {
      const playerId = String(rating.player_id || "");
      const identity = identityByFaceitId.get(playerId);
      const nickname = String(identity?.nickname || rating.nickname || "").trim();

      return {
        playerId,
        nickname,
        avatar: identity?.avatar || null,
        country: identity?.country || null,
        faceitElo: identity?.faceit_elo ?? null,
        faceitLevel: identity?.faceit_level ?? null,
        teamName: latestTeamByFaceitId.get(playerId)?.teamName || null,
        rating: rating.rating,
        recentRating: rating.recent_rating,
        matchesPlayed: rating.matches_played,
        mapsPlayed: rating.maps_played,
        adr: rating.adr,
        kd: rating.kd,
        lastMatchAt: rating.last_match_at,
      };
    })
    .filter((player) => isFaceitPlayerId(player.playerId) && player.nickname);
}

function replacePlayerMeta(html, player) {
  const metadata = getPlayerSeoMetadata(player, playerAliases);
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    name: player.nickname,
    alternateName: metadata.aliases.length ? metadata.aliases : undefined,
    identifier: player.playerId,
    url: metadata.canonicalUrl,
    image: player.avatar || undefined,
    nationality: player.country || undefined,
    description: metadata.description,
  }).replaceAll("<", "\\u003c");
  const teamText = player.teamName
    ? `<p>Текущая команда: <strong>${escapeHtml(player.teamName)}</strong></p>`
    : "";
  const aliasText = metadata.aliases.length
    ? `<p>Ранее известен как: ${metadata.aliases.map(escapeHtml).join(", ")}</p>`
    : "";
  const initialContent = `
    <main style="min-height:100vh;background:#05070a;color:#fff;font-family:Arial,sans-serif;padding:48px 24px">
      <article style="max-width:900px;margin:0 auto">
        <p style="color:#f97316;font-weight:700">ESEA Tracker</p>
        <h1>${escapeHtml(player.nickname)} — игрок ESEA CS2</h1>
        <p>${escapeHtml(metadata.description)}</p>
        ${teamText}${aliasText}
        <p><a href="/players" style="color:#fb923c">Рейтинг игроков</a> · <a href="/matches" style="color:#fb923c">Матчи ESEA CS2</a></p>
      </article>
    </main>`;

  return html
    .replace(/<html\b[^>]*>/i, '<html lang="ru">')
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${escapeHtml(metadata.description)}" />`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}" />`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${escapeHtml(metadata.title)}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`)
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${escapeHtml(metadata.canonicalUrl)}" />`)
    .replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${escapeHtml(metadata.image)}" />`)
    .replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`)
    .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script type="application/ld+json">${structuredData}</script>`)
    .replace('<div id="root"></div>', `<div id="root">${initialContent}</div>`);
}

async function writeInBatches(jobs) {
  for (let index = 0; index < jobs.length; index += WRITE_BATCH_SIZE) {
    await Promise.all(jobs.slice(index, index + WRITE_BATCH_SIZE).map((job) => job()));
  }
}

async function main() {
  const template = await readFile(templatePath, "utf8");
  const uniqueTeams = [
    ...new Map(
      teams
        .filter((team) => team?.slug && team?.name)
        .map((team) => [team.slug, team])
    ).values(),
  ];
  const players = await loadPlayersForSeo();

  await mkdir(teamsDirectory, { recursive: true });
  await mkdir(playersDirectory, { recursive: true });

  await writeInBatches([
    ...uniqueTeams.map((team) => () =>
      writeFile(
        path.join(teamsDirectory, `${team.slug}.html`),
        replaceMeta(template, team),
        "utf8"
      )
    ),
    ...players.map((player) => () =>
      writeFile(
        path.join(playersDirectory, `${player.playerId}.html`),
        replacePlayerMeta(template, player),
        "utf8"
      )
    ),
  ]);

  const lastModified = new Date().toISOString().slice(0, 10);
  const urls = [
    ...staticPages.map((route) => `${SITE_ORIGIN}${route || "/"}`),
    ...uniqueTeams.map(
      (team) => `${SITE_ORIGIN}/teams/${encodeURIComponent(team.slug)}`
    ),
    ...players.map(
      (player) => `${SITE_ORIGIN}/players/${encodeURIComponent(player.playerId)}`
    ),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastModified}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>
`;
  const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /profile/
Disallow: /auth/

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;

  await Promise.all([
    writeFile(path.join(distDirectory, "sitemap.xml"), sitemap, "utf8"),
    writeFile(path.join(distDirectory, "robots.txt"), robots, "utf8"),
  ]);

  console.log(
    `[seo] generated ${uniqueTeams.length} team pages, ${players.length} player pages and ${urls.length} sitemap URLs`
  );
}

await main();
