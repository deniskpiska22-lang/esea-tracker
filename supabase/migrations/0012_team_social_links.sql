-- team_profiles.social_links — a team's social/roster links (FACEIT, HLTV,
-- Liquipedia, website, socials), edited independently from the description
-- and from player photos in the admin "Team Profiles" screen.
alter table public.team_profiles
  add column if not exists social_links jsonb not null default '[]'::jsonb;

-- Same admin-only pattern as upsert_team_profile/set_official_team_photo —
-- the check lives in the function so it can't be bypassed by calling the
-- table directly.
create or replace function public.set_team_social_links(
  p_team_id text,
  p_social_links jsonb
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
    raise exception 'Only admins can edit team social links';
  end if;

  insert into public.team_profiles (team_id, social_links, updated_at, updated_by)
  values (p_team_id, coalesce(p_social_links, '[]'::jsonb), now(), auth.uid())
  on conflict (team_id) do update
    set social_links = excluded.social_links,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;
