import { currentLanguage } from './languages.js';
import { translateText } from './translate.js';
const labels = {
  Asia: ['Азия','Asien','Ásia','Asia','Asie','Asia'],
  Oceania: ['Океания','Ozeanien','Oceânia','Oceanía','Océanie','Oceania'],
  'Top 100 players': ['Топ-100 игроков','Top 100 Spieler','Top 100 jogadores','Top 100 jugadores','Top 100 joueurs','Top 100 giocatori'],
  'All divisions': ['Все дивизионы','Alle Divisionen','Todas as divisões','Todas las divisiones','Toutes les divisions','Tutte le divisioni'],
  'All regions': ['Все регионы','Alle Regionen','Todas as regiões','Todas las regiones','Toutes les régions','Tutte le regioni'],
  'Minimum matches': ['Минимум матчей','Mindestanzahl Matches','Mínimo de partidas','Mínimo de partidos','Minimum de matchs','Minimo partite'],
  'Search nickname': ['Поиск по нику','Nickname suchen','Procurar nickname','Buscar apodo','Rechercher un pseudo','Cerca nickname'],
  'Reset filters': ['Сбросить фильтры','Filter zurücksetzen','Limpar filtros','Restablecer filtros','Réinitialiser les filtres','Reimposta filtri'],
  'No players match these filters.': ['По этим фильтрам игроков не найдено.','Keine Spieler für diese Filter.','Nenhum jogador para estes filtros.','No hay jugadores con estos filtros.','Aucun joueur pour ces filtres.','Nessun giocatore con questi filtri.'],
  'All countries': ['Все страны','Alle Länder','Todos os países','Todos los países','Tous les pays','Tutti i paesi'],
  'Only countries with at least 100 players under the selected filters are shown.': [
    'Показаны только страны со 100 и более игроками при выбранных фильтрах.',
    'Nur Länder mit mindestens 100 Spielern bei den gewählten Filtern werden angezeigt.',
    'Apenas países com pelo menos 100 jogadores nos filtros selecionados.',
    'Solo países con al menos 100 jugadores con los filtros seleccionados.',
    'Seuls les pays ayant au moins 100 joueurs selon les filtres sélectionnés sont affichés.',
    'Solo paesi con almeno 100 giocatori nei filtri selezionati.'],
  'Overall rating across recorded matches. Division and region follow the current team; country follows player nationality.': [
    'Общий рейтинг по записанным матчам. Дивизион и регион — по текущей команде, страна — по гражданству игрока.',
    'Gesamtbewertung aller erfassten Matches. Division und Region nach aktuellem Team, Land nach Nationalität.',
    'Rating geral das partidas registadas. Divisão e região pela equipa atual; país pela nacionalidade.',
    'Rating general de los partidos registrados. División y región según el equipo actual; país según la nacionalidad.',
    'Note globale des matchs enregistrés. Division et région selon l’équipe actuelle ; pays selon la nationalité.',
    'Rating generale delle partite registrate. Divisione e regione dalla squadra attuale, paese dalla nazionalità.'],
  'Ranks are calculated within the selected filters.': ['Места рассчитаны внутри выбранной выборки.','Plätze innerhalb der ausgewählten Filter.','Posições dentro dos filtros selecionados.','Posiciones dentro de los filtros seleccionados.','Classement selon les filtres sélectionnés.','Posizioni nei filtri selezionati.'],
};
export function playersTx(text, language = currentLanguage()) {
  const index = ['ru','de','pt','es','fr','it'].indexOf(language);
  return labels[text]?.[index] || translateText(text,language);
}
