create table public.esea_coach_rosters (
  team_id text not null references public.team_catalog(team_id) on delete cascade,
  season integer not null,
  coach_id text not null,
  nickname text not null,
  country text,
  first_seen_at timestamptz not null,
  observed_at timestamptz not null,
  active boolean not null,
  primary key (team_id, season, coach_id)
);

create index esea_coach_rosters_by_coach
  on public.esea_coach_rosters (coach_id, observed_at desc);
create unique index esea_coach_rosters_active_team
  on public.esea_coach_rosters (team_id, season) where active;

alter table public.esea_coach_rosters enable row level security;
revoke all on public.esea_coach_rosters from public, anon, authenticated;
grant select, insert, update on public.esea_coach_rosters to service_role;

create function public.record_esea_coach_roster(
  p_team_id text, p_season integer, p_observed_at timestamptz,
  p_coach_id text, p_nickname text, p_country text
) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_team_id), p_season);
  if not exists (
    select 1 from public.team_catalog t join public.rating_season_settings s
      on s.active_season = p_season
    where t.team_id = p_team_id and t.team->>'activeSeasonParticipant' = 'true'
      and t.team->>'season' = p_season::text
  ) or exists (
    select 1 from public.esea_coach_rosters r
    where r.team_id = p_team_id and r.season = p_season and r.observed_at >= p_observed_at
  ) then return false;
  end if;

  update public.esea_coach_rosters
    set active = false
    where team_id = p_team_id and season = p_season and active;

  insert into public.esea_coach_rosters
    (team_id, season, coach_id, nickname, country, first_seen_at, observed_at, active)
    values (p_team_id, p_season, p_coach_id, p_nickname, p_country, p_observed_at, p_observed_at, true)
    on conflict (team_id, season, coach_id) do update
      set nickname = excluded.nickname, country = coalesce(excluded.country, esea_coach_rosters.country),
          observed_at = excluded.observed_at, active = true;
  return true;
end;
$$;

revoke all on function public.record_esea_coach_roster(text, integer, timestamptz, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_esea_coach_roster(text, integer, timestamptz, text, text, text)
  to service_role;
