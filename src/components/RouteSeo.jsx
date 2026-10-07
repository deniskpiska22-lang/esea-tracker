import { getSiteSeoMetadata } from '../utils/siteSeo.js';
import { getTeamSeoMetadata } from '../utils/teamSeo.js';
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { useTeamCatalog } from "../hooks/useTeamCatalog";

const SITE_ORIGIN = "https://eseatracker.ru";
const DEFAULT_DESCRIPTION =
  "Матчи, результаты, составы, статистика игроков и рейтинг команд ESEA CS2 со всего мира.";


function setMeta(selector, attributes, content) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function getTeamMetadata(pathname, teams) {
  const match = pathname.match(/^\/(?:teams|team)\/([^/]+)(?:\/(matches|stats|analytics|veto))?/);

  if (!match) {
    return null;
  }

  const slug = decodeURIComponent(match[1]);
  const section = match[2] || "overview";
  const team = teams.find((item) => item.slug === slug);

  if (!team) {
    return null;
  }

  return getTeamSeoMetadata(team, section === 'overview' ? '' : section, team.players || []);

}

function getMetadata(pathname, teams) {
  const teamMetadata = getTeamMetadata(pathname, teams);

  if (teamMetadata) {
    return teamMetadata;
  }

  if (/^\/(?:match|matches)\//.test(pathname)) {
    return {
      title: "Матч ESEA CS2 — счёт и статистика | ESEA Tracker",
      description:
        "Счёт, карты, составы и статистика матча ESEA Counter-Strike 2.",
      canonicalPath: pathname,
    };
  }

  if (/^\/(?:player|players)\//.test(pathname)) {
    return {
      title: "Игрок ESEA CS2 — статистика и команда | ESEA Tracker",
      description:
        "Профиль игрока ESEA CS2: команда, матчи и индивидуальная статистика.",
      canonicalPath: pathname.replace(/^\/player\//, "/players/"),
    };
  }

  return getSiteSeoMetadata(pathname);
}

export default function RouteSeo() {
  const { pathname } = useLocation();
  const { teams } = useTeamCatalog();
  const [dynamicMetadata, setDynamicMetadata] = useState(() => {
    const canonical = document.head.querySelector('link[rel="canonical"]')?.href;
    if (!canonical || new URL(canonical).pathname !== pathname) return null;
    try { return { routePath: pathname, canonicalPath: pathname, title: document.title,
      description: document.head.querySelector('meta[name="description"]')?.content || DEFAULT_DESCRIPTION,
      language: document.documentElement.lang,
      image: document.head.querySelector('meta[property="og:image"]')?.content,
      robots: document.head.querySelector('meta[name="robots"]')?.content,
      schema: JSON.parse(document.head.querySelector('script[type="application/ld+json"]')?.textContent || '{}'),
    }; } catch { return null; }
  });
  const metadata = useMemo(
    () =>
      dynamicMetadata?.routePath === pathname
        ? dynamicMetadata
        : getMetadata(pathname, teams),
    [dynamicMetadata, pathname, teams]
  );

  useEffect(() => {
    const handlePlayerMetadata = (event) => {
      if (event.detail) setDynamicMetadata(event.detail);
    };

    window.addEventListener("player-seo-update", handlePlayerMetadata);
    window.addEventListener("match-seo-update", handlePlayerMetadata);
    return () => {
      window.removeEventListener("player-seo-update", handlePlayerMetadata);
      window.removeEventListener("match-seo-update", handlePlayerMetadata);
    };
  }, []);

  useEffect(() => {
    const canonicalUrl = new URL(
      metadata.canonicalPath || pathname,
      SITE_ORIGIN
    ).toString();
    const image = new URL(metadata.image || "/logo.png", SITE_ORIGIN).toString();

    let structured = document.head.querySelector('script[type="application/ld+json"]');
    if (!structured) { structured = document.createElement("script"); structured.type = "application/ld+json"; document.head.appendChild(structured); }
    structured.textContent = JSON.stringify(metadata.schema || { "@context":"https://schema.org", "@type":"WebSite", name:"ESEA Tracker", url:SITE_ORIGIN });
    document.title = metadata.title;
    document.documentElement.lang = metadata.language || "ru";

    setMeta('meta[name="robots"]', { name: "robots" }, metadata.robots || 'index,follow,max-image-preview:large');
    setMeta('meta[property="og:locale"]', { property: "og:locale" }, metadata.language === 'en' ? 'en_US' : 'ru_RU');
    setMeta('meta[name="description"]', { name: "description" }, metadata.description);
    setMeta('meta[property="og:title"]', { property: "og:title" }, metadata.title);
    setMeta(
      'meta[property="og:description"]',
      { property: "og:description" },
      metadata.description
    );
    setMeta('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
    if (metadata.language === 'en' && !metadata.image) {
      document.head.querySelector('meta[property="og:image"]')?.remove();
      document.head.querySelector('meta[name="twitter:image"]')?.remove();
    } else {
      setMeta('meta[property="og:image"]', { property: "og:image" }, image);
      setMeta('meta[name="twitter:image"]', { name: "twitter:image" }, image);
    }
    setMeta('meta[name="twitter:title"]', { name: "twitter:title" }, metadata.title);
    setMeta(
      'meta[name="twitter:description"]',
      { name: "twitter:description" },
      metadata.description
    );

    let canonical = document.head.querySelector('link[rel="canonical"]');

    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }

    canonical.setAttribute("href", canonicalUrl);
  }, [metadata, pathname]);

  return null;
}
