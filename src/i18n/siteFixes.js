import { currentLanguage } from './languages.js';
import { translateText } from './translate.js';
const copy = {
  'All matches': ['Все матчи','Alle Matches','Todas as partidas','Todos los partidos','Tous les matchs','Tutte le partite'],
  Status: ['Статус','Status','Estado','Estado','Statut','Stato'],
  'All divisions': ['Все дивизионы','Alle Divisionen','Todas as divisões','Todas las divisiones','Toutes les divisions','Tutte le divisioni'],
  'No matches found': ['Матчи не найдены','Keine Matches gefunden','Nenhuma partida encontrada','No se encontraron partidos','Aucun match trouvé','Nessuna partita trovata'],
  'Retry loading': ['Повторить загрузку','Erneut laden','Tentar novamente','Volver a cargar','Réessayer','Riprova'],
  'Load more': ['Показать ещё','Mehr anzeigen','Mostrar mais','Mostrar más','Afficher plus','Mostra altro'],
  'Recent results': ['Последние результаты','Letzte Ergebnisse','Resultados recentes','Resultados recientes','Résultats récents','Risultati recenti'],
  'Match schedule and results': ['Расписание и результаты матчей','Spielplan und Ergebnisse','Calendário e resultados','Calendario y resultados','Calendrier et résultats','Calendario e risultati'],
  'Country filter cleared: fewer than 100 players match the selected filters.': ['Фильтр страны сброшен: при выбранных фильтрах осталось меньше 100 игроков.','Länderfilter entfernt: Weniger als 100 Spieler passen zu den Filtern.','Filtro de país removido: menos de 100 jogadores nos filtros selecionados.','Filtro de país eliminado: menos de 100 jugadores con estos filtros.','Filtre de pays retiré : moins de 100 joueurs correspondent aux filtres.','Filtro paese rimosso: meno di 100 giocatori con questi filtri.'],
  'Recent results are limited to the latest 250 completed matches.': ['Показаны последние 250 завершённых матчей.','Die letzten 250 abgeschlossenen Matches werden angezeigt.','São mostradas as últimas 250 partidas concluídas.','Se muestran los últimos 250 partidos terminados.','Les 250 derniers matchs terminés sont affichés.','Sono mostrate le ultime 250 partite concluse.'],
};
export function fixTx(text, language = currentLanguage()) {
  return copy[text]?.[['ru','de','pt','es','fr','it'].indexOf(language)] || translateText(text,language);
}
