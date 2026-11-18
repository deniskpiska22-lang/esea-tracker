import { currentLanguage } from './languages.js';
import { translateText } from './translate.js';
const labels = {
  'Top 100 players': ['Топ-100 игроков','Top 100 Spieler','Top 100 jogadores','Top 100 jugadores','Top 100 joueurs','Top 100 giocatori'],
  'All divisions': ['Все дивизионы','Alle Divisionen','Todas as divisões','Todas las divisiones','Toutes les divisions','Tutte le divisioni'],
  'All regions': ['Все регионы','Alle Regionen','Todas as regiões','Todas las regiones','Toutes les régions','Tutte le regioni'],
  'Minimum matches': ['Минимум матчей','Mindestanzahl Matches','Mínimo de partidas','Mínimo de partidos','Minimum de matchs','Minimo partite'],
  'Search nickname': ['Поиск по нику','Nickname suchen','Procurar nickname','Buscar apodo','Rechercher un pseudo','Cerca nickname'],
  'Reset filters': ['Сбросить фильтры','Filter zurücksetzen','Limpar filtros','Restablecer filtros','Réinitialiser les filtres','Reimposta filtri'],
  'No players match these filters.': ['По этим фильтрам игроков не найдено.','Keine Spieler für diese Filter.','Nenhum jogador para estes filtros.','No hay jugadores con estos filtros.','Aucun joueur pour ces filtres.','Nessun giocatore con questi filtri.'],
  'Overall rating across recorded matches. Division follows the current team; region follows player nationality.': [
    'Общий рейтинг по записанным матчам. Дивизион — по текущей команде, регион — по гражданству игрока.',
    'Gesamtbewertung aller erfassten Matches. Division nach aktuellem Team, Region nach Nationalität.',
    'Rating geral das partidas registadas. Divisão pela equipa atual; região pela nacionalidade do jogador.',
    'Rating general de los partidos registrados. División según el equipo actual; región según la nacionalidad.',
    'Note globale des matchs enregistrés. Division selon l’équipe actuelle ; région selon la nationalité.',
    'Rating generale delle partite registrate. Divisione dalla squadra attuale, regione dalla nazionalità.'],
  'Ranks are calculated within the selected filters.': ['Места рассчитаны внутри выбранной выборки.','Plätze innerhalb der ausgewählten Filter.','Posições dentro dos filtros selecionados.','Posiciones dentro de los filtros seleccionados.','Classement selon les filtres sélectionnés.','Posizioni nei filtri selezionati.'],
};
export function playersTx(text, language = currentLanguage()) {
  const index = ['ru','de','pt','es','fr','it'].indexOf(language);
  return labels[text]?.[index] || translateText(text,language);
}
