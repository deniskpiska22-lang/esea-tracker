const keys=['points','rank','latest','period','month','months','all','teamRating','hover','snapshots','vsPrevious','noRank','noData'];
const rows={
 en:['Points','World rank','Latest snapshot','Over selected period','1 month','3 months','All history','Team rating','Select a point for snapshot details','Weekly snapshots','Since previous snapshot','Rank not recorded','No snapshots for this period'],
 ru:['Очки','Место в мире','Последний срез','За выбранный период','Месяц','3 месяца','Вся история','Рейтинг команды','Выберите точку для подробностей среза','Еженедельные срезы','С прошлого среза','Место не записано','Нет срезов за этот период'],
 de:['Punkte','Weltrang','Letzter Stand','Im gewählten Zeitraum','1 Monat','3 Monate','Gesamter Verlauf','Teamwertung','Punkt für Details auswählen','Wöchentliche Stände','Seit dem letzten Stand','Rang nicht erfasst','Keine Daten in diesem Zeitraum'],
 pt:['Pontos','Posição mundial','Último registro','No período selecionado','1 mês','3 meses','Todo o histórico','Rating da equipe','Selecione um ponto para ver detalhes','Registros semanais','Desde o registro anterior','Posição não registrada','Sem registros neste período'],
 es:['Puntos','Puesto mundial','Último registro','En el período seleccionado','1 mes','3 meses','Todo el historial','Rating del equipo','Selecciona un punto para ver detalles','Registros semanales','Desde el registro anterior','Puesto no registrado','Sin registros en este período'],
 fr:['Points','Rang mondial','Dernier relevé','Sur la période choisie','1 mois','3 mois','Tout l’historique','Note de l’équipe','Sélectionnez un point pour les détails','Relevés hebdomadaires','Depuis le relevé précédent','Rang non enregistré','Aucun relevé sur cette période'],
 it:['Punti','Posizione mondiale','Ultima rilevazione','Nel periodo selezionato','1 mese','3 mesi','Tutta la cronologia','Rating della squadra','Seleziona un punto per i dettagli','Rilevazioni settimanali','Dalla rilevazione precedente','Posizione non registrata','Nessuna rilevazione nel periodo'],
};
export function ratingHistoryLabels(language) { return Object.fromEntries(keys.map((key,i)=>[key,(rows[language]||rows.en)[i]])); }
