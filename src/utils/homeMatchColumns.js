// Cards do not need the complete FACEIT response or player statistics.
export const MATCH_CARD_COLUMNS = [
  "id", "competition_name", "status", "best_of", "scheduled_at",
  "started_at", "finished_at", "team1_id", "team1_name", "team1_slug",
  "team1_logo", "team1_score", "team2_id", "team2_name", "team2_slug",
  "team2_logo", "team2_score", "maps", "map_scores", "stats_synced",
  "detailed_results:raw_data->detailed_results",
  "source_team1_id:raw_data->teams->faction1->>faction_id",
  "source_team1_logo:raw_data->teams->faction1->>avatar",
  "source_team2_id:raw_data->teams->faction2->>faction_id",
  "source_team2_logo:raw_data->teams->faction2->>avatar",
].join(",");

