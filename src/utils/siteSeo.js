const DEFAULT_TITLE = 'ESEA Tracker — команды, матчи и рейтинг ESEA CS2';
const DEFAULT_DESCRIPTION = 'Матчи, результаты, составы, статистика игроков и рейтинг команд ESEA CS2 со всего мира.';
export const pageMetadata = {
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

export function getSiteSeoMetadata(pathname) {
  const metadata = pageMetadata[pathname] || {title:'Page not found | ESEA Tracker',description:'This page is unavailable.'};
  return {...metadata, heading: metadata.title.replace(/ \| ESEA Tracker$/, ''), canonicalPath: pathname,
    language: 'ru', robots: pathname in pageMetadata ? 'index,follow,max-image-preview:large' : 'noindex,follow',
    schema: {'@context':'https://schema.org','@type': pathname==='/' ? 'WebSite' : pathname==='/about' ? 'AboutPage' : 'CollectionPage',name:metadata.title,url:`https://eseatracker.ru${pathname}`,description:metadata.description},
  };
}
