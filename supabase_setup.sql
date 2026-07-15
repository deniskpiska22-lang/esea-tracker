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
