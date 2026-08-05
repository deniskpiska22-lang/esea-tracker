-- team_rating_history_team_week_key only covered (team_id, week_start), so a
-- weekly snapshot and a same-week match-recalculation snapshot for the same
-- team upsert into the same row and silently clobber each other (whichever
-- writes last wins, including its snapshot_type). Widen the unique key to
-- include snapshot_type so both kinds of snapshot can coexist per team/week.
drop index if exists public.team_rating_history_team_week_key;

-- onConflict: "team_id,week_start,snapshot_type" in
-- snapshotWeeklyRatingHistory.js and snapshotRatingChanges.js.
create unique index if not exists team_rating_history_team_week_type_key
  on public.team_rating_history (team_id, week_start, snapshot_type);
