import { LANGUAGES, localizedPath } from '../i18n/languages.js';
import { translateText } from '../i18n/translate.js';
import { mapName, teamMapPath } from './teamMapStats.js';

export function getTeamMapSeo(team, map, language = 'ru') {
  const name = mapName(map);
  const pathname = teamMapPath(team, name);
  const heading = `${team.name} · ${name} — ${translateText('Map Statistics', language)}`;
  const description = translateText('Tracked matches, win rate, round results, picks and bans for {0} on {1}.', language)
    .replace('{0}', team.name).replace('{1}', name);
  const canonicalPath = localizedPath(pathname, language);
  const url = `https://eseatracker.ru${canonicalPath}`;
  return { title: `${heading} | ESEA Tracker`, heading, description, canonicalPath, language, localized: true,
    robots: 'index,follow,max-image-preview:large',
    alternates: [...LANGUAGES.map(item => ({ language: item.code, url: `https://eseatracker.ru${localizedPath(pathname, item.code)}` })), { language: 'x-default', url: `https://eseatracker.ru${pathname}` }],
    schema: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: heading, description, url, inLanguage: language,
      about: { '@type': 'SportsTeam', name: team.name, identifier: team.faceitTeamId } },
  };
}
