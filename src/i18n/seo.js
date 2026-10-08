import { getTeamContext } from '../utils/teamSeo.js';
import { LANGUAGES, LANGUAGE_CODES, localizedPath, stripLanguage } from './languages.js';
import { translateText } from './translate.js';
const ORIGIN = 'https://eseatracker.ru';
const DIRECTORY_LABELS = { '/': 'Home', '/rankings': 'Team rankings', '/matches': 'Match schedule and results', '/players': 'Player statistics', '/calendar': 'Tournament calendar', '/about': 'About ESEA Tracker', '/media': 'Community media' };
const COPY = {
  ru: {intro:'Команды, игроки, матчи и рейтинг ESEA Counter-Strike 2 из Европы, Северной и Южной Америки.', team:'{name} — команда Counter-Strike 2 в {league}. Состав, результаты матчей, статистика карт, пики и баны, рейтинг команды на ESEA Tracker.', player:'{name}: статистика игрока ESEA CS2, команда, рейтинг, ADR, K/D и последние матчи.', match:'{name}: счёт матча ESEA CS2, результаты карт, составы и статистика игроков.', sample:'Выборка из последних {n} завершённых матчей. Полная история доступна на странице статистики карт.'},
  en: {intro:'ESEA Counter-Strike 2 teams, players, matches and rankings across Europe, North America and South America.', team:'{name} is a Counter-Strike 2 team in {league}. Follow its roster, match results, map statistics, picks and bans and team rating on ESEA Tracker.', player:'{name}: ESEA CS2 player statistics, team, rating, ADR, K/D and recent matches.', match:'{name}: ESEA CS2 match score, map results, lineups and player statistics.', sample:'This sample covers the latest {n} completed matches. Open the map statistics page for the full tracked history.'},
  de: {intro:'ESEA Counter-Strike 2: Teams, Spieler, Matches und Ranglisten aus Europa, Nordamerika und Südamerika.', team:'{name} ist ein Counter-Strike-2-Team in {league}. Kader, Matchergebnisse, Kartenstatistiken, Picks, Bans und Teambewertung auf ESEA Tracker.', player:'{name}: ESEA-CS2-Spielerstatistiken, Team, Bewertung, ADR, K/D und aktuelle Matches.', match:'{name}: ESEA-CS2-Matchstand, Kartenergebnisse, Aufstellungen und Spielerstatistiken.', sample:'Diese Auswahl umfasst die letzten {n} abgeschlossenen Matches. Den gesamten Verlauf finden Sie in den Kartenstatistiken.'},
  pt: {intro:'Equipes, jogadores, partidas e rankings de ESEA Counter-Strike 2 na Europa, América do Norte e América do Sul.', team:'{name} é uma equipe de Counter-Strike 2 em {league}. Confira elenco, resultados, estatísticas de mapas, escolhas, banimentos e rating no ESEA Tracker.', player:'{name}: estatísticas de jogador ESEA CS2, equipe, rating, ADR, K/D e partidas recentes.', match:'{name}: placar de partida ESEA CS2, resultados dos mapas, elencos e estatísticas dos jogadores.', sample:'Esta amostra inclui as últimas {n} partidas concluídas. Veja as estatísticas de mapas para o histórico completo.'},
  es: {intro:'Equipos, jugadores, partidos y clasificaciones de ESEA Counter-Strike 2 en Europa, Norteamérica y Sudamérica.', team:'{name} es un equipo de Counter-Strike 2 en {league}. Consulta plantilla, resultados, estadísticas de mapas, elecciones, vetos y valoración en ESEA Tracker.', player:'{name}: estadísticas de jugador ESEA CS2, equipo, valoración, ADR, K/D y partidos recientes.', match:'{name}: marcador de partido ESEA CS2, resultados de mapas, plantillas y estadísticas de jugadores.', sample:'Esta muestra incluye los últimos {n} partidos finalizados. Consulta las estadísticas de mapas para el historial completo.'},
  fr: {intro:'Équipes, joueurs, matchs et classements ESEA Counter-Strike 2 en Europe, Amérique du Nord et Amérique du Sud.', team:'{name} est une équipe de Counter-Strike 2 dans {league}. Effectif, résultats, statistiques des cartes, picks, bans et note sur ESEA Tracker.', player:'{name} : statistiques de joueur ESEA CS2, équipe, note, ADR, K/D et matchs récents.', match:'{name} : score du match ESEA CS2, résultats des cartes, compositions et statistiques des joueurs.', sample:'Cet échantillon couvre les {n} derniers matchs terminés. Consultez les statistiques des cartes pour l’historique complet.'},
  it: {intro:'Squadre, giocatori, partite e classifiche ESEA Counter-Strike 2 in Europa, Nord America e Sud America.', team:'{name} è una squadra di Counter-Strike 2 in {league}. Roster, risultati, statistiche mappe, pick, ban e rating su ESEA Tracker.', player:'{name}: statistiche giocatore ESEA CS2, squadra, rating, ADR, K/D e ultime partite.', match:'{name}: punteggio partita ESEA CS2, risultati mappe, formazioni e statistiche giocatori.', sample:'Questo campione comprende le ultime {n} partite concluse. Consulta le statistiche mappe per la cronologia completa.'},
};
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
export function alternateLanguages(pathname) {
  return [...LANGUAGE_CODES.map(language => ({language, url:ORIGIN + localizedPath(pathname, language)})), {language:'x-default',url:ORIGIN+localizedPath(pathname,'en')}];
}
function localizeSchema(value, language, title, description) {
  if (Array.isArray(value)) return value.map(item => localizeSchema(item, language, title, description));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && ['url','@id','item'].includes(key) && item.startsWith(ORIGIN)) out[key] = ORIGIN+localizedPath(item.slice(ORIGIN.length)||'/',language);
    else out[key] = localizeSchema(item,language,title,description);
  }
  if (value.inLanguage) out.inLanguage = language;
  if (['WebPage','WebSite','CollectionPage','AboutPage'].includes(value['@type'])) { out.name=title; out.description=description; out.inLanguage=language; }
  if (value['@type']==='SportsTeam' && value.description) out.description=description;
  if (value['@type']==='ListItem' && value.name && value.position!==3) out.name=translateText(value.name,language);
  return out;
}
export function localizeSeo(metadata, language, {kind, entity, section = ''} = {}) {
  language = LANGUAGE_CODES.includes(language) ? language : 'ru';
  const t = text => translateText(text,language);
  const pathname = stripLanguage(metadata.canonicalPath || (metadata.canonicalUrl ? new URL(metadata.canonicalUrl).pathname : '/'));
  const inferred = kind || (/^\/teams\//.test(pathname) ? 'team' : /^\/players\//.test(pathname) ? 'player' : /^\/match\//.test(pathname) ? 'match' : 'page');
  let title,description,heading;
  if (inferred==='page') {
    const label = DIRECTORY_LABELS[pathname];
    heading = t(label || 'Page not found');
    title = label ? `${heading}${pathname==='/about' ? '' : ' — ESEA CS2'} | ESEA Tracker` : `${heading} | ESEA Tracker`;
    description = label ? `${heading}. ${COPY[language].intro}` : t('This page is unavailable.');
  } else {
    const fallbackName = metadata.heading?.split(' — ')[0] || metadata.title?.split(/ CS2 | — /)[0] || 'CS2';
    const name = entity?.name || entity?.nickname || (inferred==='match' && entity ? `${entity.team1_name || 'TBD'} vs ${entity.team2_name || 'TBD'}` : fallbackName);
    const topic = inferred==='team' ? ({matches:'Matches & Results', stats:'Map Statistics', veto:'Map Picks & Bans', analytics:'Analytics'}[section || pathname.split('/')[3]] || 'Roster & Results') : inferred==='player' ? 'CS2 player statistics' : 'Match Information';
    heading = `${name} — ${t(topic)}`;
    const context = inferred==='team' ? getTeamContext(entity) : {};
    let country = context.country;
    if (entity?.country && /^[a-z]{2}$/i.test(entity.country)) {
      try { country = new Intl.DisplayNames([language],{type:'region'}).of(entity.country.toUpperCase()); } catch { /* Retain known name. */ }
    }
    const league = ['ESEA',context.division,(context.region || '').split(' / ').map(t).join(' / '),country,context.season ? `${t('Season')} ${context.season}` : ''].filter(Boolean).join(' · ');
    title = `${heading} | ${inferred==='team' ? league : 'ESEA Tracker'}`;
    description = fill(COPY[language][inferred],{name,league});
    if (inferred==='team' && entity?.activeSeasonParticipant===false) description=`${name} — ${t('CS2 Team')}. ${t('Recorded participation')}: ${league}. ${t('Roster & Results')}, ${t('Map statistics')}, ${t('Map picks and bans')}.`;
    if (inferred==='match' && entity) {
      const finished = ['FINISHED','MATCH_STATUS_FINISHED'].includes(entity.status);
      if (finished && entity.team1_score!=null && entity.team2_score!=null) title=`${name} ${entity.team1_score}–${entity.team2_score} — ${t('Match Information')} | ESEA Tracker`;
      const date=entity.scheduled_at || entity.started_at || entity.finished_at;
      description += ` ${[entity.competition_name, date && !Number.isNaN(new Date(date).getTime()) ? new Date(date).toISOString().slice(0,10) : ''].filter(Boolean).join(' · ')}`;
    }
  }
  const canonicalPath = localizedPath(pathname,language);
  return {...metadata,localized:true,title,description,heading,language,canonicalPath,canonicalUrl:ORIGIN+canonicalPath,
    intro: inferred==='team' ? description : metadata.intro,
    schema:localizeSchema(metadata.schema,language,title,description),
    alternates: metadata.robots?.includes('noindex') ? [] : alternateLanguages(pathname),
    ogLocale:LANGUAGES.find(item=>item.code===language).og,
  };
}
export function localizeBody(body, language) {
  // Translate only authored text nodes; names, nicknames, scores and user content remain literal.
  const source = String(body || '');
  return source.replace(/>([^<>]+)</g, (full, text, offset) => {
    if (/<a\b[^>]*data-entity-link="true"[^>]*>$/.test(source.slice(0,offset+1))) return full;
    const trimmed=text.trim();const leading=text.slice(0,text.indexOf(trimmed));const trailing=text.slice(text.indexOf(trimmed)+trimmed.length);
    let translated=translateText(trimmed,language);
    const roster=trimmed.match(/^(.*?) CS2 roster$/);
    const results=trimmed.match(/^Recent (.*?) match results$/);
    const sample=trimmed.match(/^This sample covers the latest (\d+) completed matches\. Open the map statistics page for the full tracked history\.$/);
    if(roster) translated=`${roster[1]} — ${translateText('CS2 roster',language)}`;
    if(results) translated=`${results[1]} — ${translateText('match results',language)}`;
    if(sample) translated=fill(COPY[language].sample,{n:sample[1]});
    translated=translated.replace(/(\d+) tracked maps?\b/g,(_,n)=>`${n} ${translateText(Number(n)===1?'tracked map':'tracked maps',language)}`)
      .replace(/(\d+) picks, (\d+) bans\b/g,(_,a,b)=>`${a} ${translateText('picks',language)}, ${b} ${translateText('bans',language)}`);
    return `>${leading}${translated}${trailing}<`;
  }).replace(/aria-label="([^"]+)"/g,(_,label)=>`aria-label="${translateText(label,language)}"`).replace(/href="(\/[^" ]*)"/g,(_,url)=>`href="${localizedPath(url,language)}"`);
}
