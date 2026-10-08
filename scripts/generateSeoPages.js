import { LANGUAGE_CODES, localizedPath } from '../src/i18n/languages.js';
import { localizeSeo } from '../src/i18n/seo.js';
import { getSiteSeoMetadata } from '../src/utils/siteSeo.js';
import { TEAM_SECTIONS, teamSitemapEntries } from '../src/utils/teamSeo.js';
import { profileMetadata, renderProfile } from '../server/profileSeo.js';
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

import teams from "../src/data/teams.generated.js";
import {
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

function replaceMeta(html, team, section = '') {
  const roster = (team.players || []).filter(player => player?.nickname && player?.faceit_id);
  return renderProfile(html, localizeSeo(profileMetadata('team', team, roster, section), 'ru', {kind:'team',entity:team,section}));
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

async function loadCatalogForSeo() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const client = createClient(url, key, {auth:{persistSession:false,autoRefreshToken:false}});
  return (await fetchAllRows(client, "team_catalog", "team_id,team,updated_at", q => q.order("team_id"))).map(row => ({...row.team, updatedAt:row.updated_at}));
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

  const ratingById = new Map(ratings.map(r => [String(r.player_id), r]));
  const allIds = new Set([...ratingById.keys(), ...identityByFaceitId.keys()]);
  return [...allIds]
    .map((id) => {
      const rating = ratingById.get(id) || {player_id:id};
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
  return renderProfile(html, localizeSeo(profileMetadata('player', player), 'ru', {kind:'player',entity:player}));
}

async function writeInBatches(jobs) {
  for (let index = 0; index < jobs.length; index += WRITE_BATCH_SIZE) {
    await Promise.all(jobs.slice(index, index + WRITE_BATCH_SIZE).map((job) => job()));
  }
}

async function main() {
  const template = await readFile(templatePath, "utf8");
  // Vercel serves fresh profiles through API routes; static hosts need snapshots.
  const dynamicProfiles = process.env.VERCEL === "1";
  const catalog = dynamicProfiles ? [] : await loadCatalogForSeo();
  const uniqueTeams = [
    ...new Map(
      [...teams, ...catalog]
        .filter((team) => team?.slug && team?.name)
        .map((team) => [team.slug, team])
    ).values(),
  ];
  const players = dynamicProfiles ? [] : await loadPlayersForSeo();

  await mkdir(teamsDirectory, { recursive: true });
  await mkdir(playersDirectory, { recursive: true });

  await writeInBatches([
    ...uniqueTeams.flatMap((team) => ['', ...TEAM_SECTIONS].map(section => async () => {
      const directory = section ? path.join(teamsDirectory, team.slug) : teamsDirectory;
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, section ? `${section}.html` : `${team.slug}.html`), replaceMeta(template, team, section), 'utf8');
    })),
    ...players.map((player) => () =>
      writeFile(
        path.join(playersDirectory, `${player.playerId}.html`),
        replacePlayerMeta(template, player),
        "utf8"
      )
    ),
  ]);

  const baseUrls = [
    ...staticPages.map((route) => `${SITE_ORIGIN}${route || "/"}`),
    ...uniqueTeams.flatMap(team => teamSitemapEntries(`${SITE_ORIGIN}/teams/${encodeURIComponent(team.slug)}`).map(entry => entry.url)),
    ...players.map(
      (player) => `${SITE_ORIGIN}/players/${encodeURIComponent(player.playerId)}`
    ),
  ];
  const urls = baseUrls.flatMap(url=>LANGUAGE_CODES.map(language=>SITE_ORIGIN+localizedPath(new URL(url).pathname,language)));
  await writeInBatches(LANGUAGE_CODES.flatMap(language=>staticPages.map(route=>async()=>{
    const pathname=route || '/';
    const localized=localizedPath(pathname,language);
    if (localized === '/') return; // Keep dist/index.html as the clean API/SPA template.
    const directory=localized==='/' ? distDirectory : path.join(distDirectory,localized);
    await mkdir(directory,{recursive:true});
    await writeFile(path.join(directory,'index.html'),renderProfile(template,localizeSeo(getSiteSeoMetadata(pathname),language)), 'utf8');
  })));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
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
    writeFile(path.join(distDirectory, "sitemap-static.xml"), sitemap, "utf8"),
    writeFile(path.join(distDirectory, "robots.txt"), robots, "utf8"),
  ]);

  console.log(
    `[seo] generated ${uniqueTeams.length} team pages, ${players.length} player pages and ${urls.length} sitemap URLs`
  );
}

await main();
