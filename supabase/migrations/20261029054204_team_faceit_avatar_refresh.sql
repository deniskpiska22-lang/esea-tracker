-- Keep current FACEIT artwork independent of season-imported JSON snapshots.
alter table public.team_catalog add column if not exists faceit_avatar_url text;
alter table public.team_catalog add column if not exists faceit_avatar_synced_at timestamptz;
