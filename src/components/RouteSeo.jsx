import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

import teams from "../data/teams";

const SITE_ORIGIN = "https://eseatracker.ru";
const DEFAULT_TITLE =
  "ESEA Tracker — команды, матчи и рейтинг ESEA CS2";
const DEFAULT_DESCRIPTION =
  "Матчи, результаты, составы, статистика игроков и рейтинг команд ESEA CS2 со всего мира.";

const pageMetadata = {
  "/": {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  "/rankings": {
    title: "Рейтинг команд ESEA CS2 | ESEA Tracker",
    description:
      "Актуальный мировой рейтинг команд ESEA CS2: позиции, изменения рейтинга, дивизионы и регионы.",
  },
  "/matches": {
    title: "Матчи ESEA CS2 — расписание и результаты | ESEA Tracker",
    description:
      "Предстоящие и завершённые матчи ESEA CS2, результаты серий и подробная статистика.",
  },
  "/players": {
    title: "Игроки ESEA CS2 — статистика и рейтинг | ESEA Tracker",
    description:
      "Статистика, команды и рейтинг игроков ESEA CS2 со всего мира.",
  },
  "/calendar": {
    title: "Календарь турниров ESEA CS2 | ESEA Tracker",
    description:
      "Календарь турниров и событий ESEA CS2: даты, матчи и участники.",
  },
  "/about": {
    title: "О проекте | ESEA Tracker",
    description:
      "ESEA Tracker — независимый трекер команд, матчей, игроков и рейтингов ESEA Counter-Strike 2.",
  },
  "/media": {
    title: "Медиа ESEA CS2 | ESEA Tracker",
    description: "Новости и материалы сообщества ESEA Counter-Strike 2.",
  },
};

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

function getTeamMetadata(pathname) {
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

  const sectionLabels = {
    overview: "матчи, состав, статистика и рейтинг",
    matches: "матчи и результаты",
    stats: "статистика",
    analytics: "аналитика",
    veto: "карты и вето",
  };
  const details = [
    team.division ? `${team.division} Division` : null,
    team.country || null,
    team.season ? `сезон ${team.season}` : null,
  ].filter(Boolean);
  const suffix = details.length > 0 ? ` ${details.join(", ")}.` : "";
  const canonicalSection = section === "overview" ? "" : `/${section}`;

  return {
    title: `${team.name}: ${sectionLabels[section]} CS2 | ESEA Tracker`,
    description: `${team.name} — ${sectionLabels[section]} ESEA CS2.${suffix}`,
    canonicalPath: `/teams/${team.slug}${canonicalSection}`,
    image: team.logo || `${SITE_ORIGIN}/logo.png`,
  };
}

function getMetadata(pathname) {
  const teamMetadata = getTeamMetadata(pathname);

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

  const metadata = pageMetadata[pathname] || pageMetadata["/"];

  return {
    ...metadata,
    canonicalPath: pathname in pageMetadata ? pathname : "/",
  };
}

export default function RouteSeo() {
  const { pathname } = useLocation();
  const metadata = useMemo(() => getMetadata(pathname), [pathname]);

  useEffect(() => {
    const canonicalUrl = new URL(
      metadata.canonicalPath || pathname,
      SITE_ORIGIN
    ).toString();
    const image = metadata.image || `${SITE_ORIGIN}/logo.png`;

    document.title = metadata.title;
    document.documentElement.lang = "ru";

    setMeta('meta[name="description"]', { name: "description" }, metadata.description);
    setMeta('meta[property="og:title"]', { property: "og:title" }, metadata.title);
    setMeta(
      'meta[property="og:description"]',
      { property: "og:description" },
      metadata.description
    );
    setMeta('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
    setMeta('meta[property="og:image"]', { property: "og:image" }, image);
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
