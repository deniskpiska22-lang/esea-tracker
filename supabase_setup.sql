-- Run once in Supabase SQL Editor.

alter table public.matches enable row level security;

revoke insert, update, delete
on table public.matches
from anon, authenticated;

grant select
on table public.matches
 to anon, authenticated;

drop policy if exists "Public can read matches"
on public.matches;

create policy "Public can read matches"
on public.matches
for select
to anon, authenticated
using (true);

-- Recommended indexes for automatic match feeds.
create index if not exists matches_status_scheduled_at_idx
on public.matches (status, scheduled_at);

create index if not exists matches_finished_at_idx
on public.matches (finished_at desc);

-- Automatic FACEIT map collection. Safe to run repeatedly.
alter table public.matches add column if not exists maps jsonb not null default '[]'::jsonb;
alter table public.matches add column if not exists map_scores jsonb not null default '[]'::jsonb;
alter table public.matches add column if not exists stats_synced boolean not null default false;
alter table public.matches add column if not exists stats_synced_at timestamptz;

create index if not exists matches_finished_stats_sync_idx
on public.matches (stats_synced, finished_at)
where status in ('FINISHED', 'MATCH_STATUS_FINISHED');
