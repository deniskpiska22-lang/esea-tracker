-- Separate profile freshness from roster/name edits. Existing values keep their
-- provenance unknown and are refreshed gradually by the bounded worker.
alter table public.players add column if not exists faceit_profile_synced_at timestamptz;
create index if not exists players_faceit_profile_refresh_idx
  on public.players (faceit_profile_synced_at nulls first, faceit_id);
