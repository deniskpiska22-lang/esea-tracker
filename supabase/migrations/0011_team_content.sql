-- team_profiles — curated content that must survive `npm run v2:sync`.
--
-- Teams themselves are not rows in this database: they live in the
-- generated src/data/teams.generated.js, fully overwritten on every
-- standings sync. This table is the overlay for anything an admin curates
-- by hand (currently: a description) so it isn't wiped by the next sync.
-- `team_id` is the FACEIT team id, the same key already used by
-- team_ratings/team_players/team_player_appearances.
create table if not exists public.team_profiles (
  team_id text primary key,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.team_profiles enable row level security;

revoke insert, update, delete on table public.team_profiles from anon, authenticated;
grant select on table public.team_profiles to anon, authenticated;

drop policy if exists "Public can read team profiles" on public.team_profiles;
create policy "Public can read team profiles"
  on public.team_profiles for select to anon, authenticated using (true);

-- team_players already carries official_photo_url/official_photo_verified/
-- official_photo_verified_at/official_photo_verified_by (see
-- 0001_baseline_schema.sql) but nothing has ever written to them and nothing
-- writes to team_players from the client — it's only ever upserted by sync
-- scripts using the service role key. Lock that down explicitly.
revoke insert, update, delete on table public.team_players from anon, authenticated;

-- Both writes below are admin-only, enforced inside the function (not just
-- by RLS) so the check can't be bypassed by calling the tables directly —
-- the same pattern already used by submit_team_claim/review_team_claim.
create or replace function public.upsert_team_profile(
  p_team_id text,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin
  ) then
    raise exception 'Only admins can edit team profiles';
  end if;

  insert into public.team_profiles (team_id, description, updated_at, updated_by)
  values (p_team_id, p_description, now(), auth.uid())
  on conflict (team_id) do update
    set description = excluded.description,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

create or replace function public.set_official_team_photo(
  p_team_id text,
  p_player_id uuid,
  p_photo_url text,
  p_verified boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin
  ) then
    raise exception 'Only admins can set official player photos';
  end if;

  update public.team_players
  set official_photo_url = p_photo_url,
      official_photo_verified = p_verified,
      official_photo_verified_at = case when p_verified then now() else null end,
      official_photo_verified_by = case when p_verified then auth.uid() else null end
  where team_id = p_team_id and player_id = p_player_id;
end;
$$;
