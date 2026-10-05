-- Exact team lookups must not scan the complete match/catalog inventories.
set local lock_timeout = '3s';
set local statement_timeout = '90s';
create index if not exists matches_team1_id_idx on public.matches(team1_id);
create index if not exists matches_team2_id_idx on public.matches(team2_id);
create index if not exists team_catalog_slug_idx on public.team_catalog ((team->>'slug'));
