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
