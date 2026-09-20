import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import teams from "../src/data/teams.generated.js";

const SITE_ORIGIN = "https://eseatracker.ru";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const distDirectory = path.join(projectRoot, "dist");
const teamsDirectory = path.join(distDirectory, "teams");
const templatePath = path.join(distDirectory, "index.html");

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

async function main() {
  const template = await readFile(templatePath, "utf8");
  const uniqueTeams = [
    ...new Map(
      teams
        .filter((team) => team?.slug && team?.name)
        .map((team) => [team.slug, team])
    ).values(),
  ];

  await mkdir(teamsDirectory, { recursive: true });

  await Promise.all(
    uniqueTeams.map((team) =>
      writeFile(
        path.join(teamsDirectory, `${team.slug}.html`),
        replaceMeta(template, team),
        "utf8"
      )
    )
  );

  const lastModified = new Date().toISOString().slice(0, 10);
  const urls = [
    ...staticPages.map((route) => `${SITE_ORIGIN}${route || "/"}`),
    ...uniqueTeams.map(
      (team) => `${SITE_ORIGIN}/teams/${encodeURIComponent(team.slug)}`
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
    `[seo] generated ${uniqueTeams.length} team pages and ${urls.length} sitemap URLs`
  );
}

await main();
