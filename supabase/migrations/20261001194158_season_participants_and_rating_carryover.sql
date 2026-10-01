-- Public rating data; writes and activation are restricted to backend workers.
create table public.rating_seasons (
  season integer primary key,
  season_id text not null unique,
  rating_from timestamptz,
  imported_at timestamptz,
  imports jsonb not null default '[]'
);
create table public.rating_season_settings (
  id boolean primary key default true check (id),
  active_season integer not null references public.rating_seasons(season)
);
create table public.team_season_participation (
  season integer not null references public.rating_seasons(season),
  team_id text not null,
  league_team_id text,
  region text not null,
  division text not null check (division in ('Entry','Intermediate','Main','Advanced')),
  registered boolean not null default true,
  primary key (season, team_id)
);
create table public.team_season_rating_seeds (
  season integer not null references public.rating_seasons(season),
  team_id text not null,
  points integer not null,
  matches_played integer not null,
  ranking_status text not null,
  primary key (season, team_id)
);
create table public.team_season_rating_archive (
  season integer not null references public.rating_seasons(season),
  team_id text not null,
  world_rank integer not null,
  rating jsonb not null,
  archived_at timestamptz not null default now(),
  primary key (season, team_id)
);
create table public.team_catalog (
  team_id text primary key,
  team jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.rating_seasons(season,season_id)
values (58,'ec187700-30e2-4245-b5e2-daa762db12fc');
insert into public.rating_season_settings(id,active_season) values (true,58);

alter table public.rating_seasons enable row level security;
alter table public.rating_season_settings enable row level security;
alter table public.team_season_participation enable row level security;
alter table public.team_season_rating_seeds enable row level security;
alter table public.team_season_rating_archive enable row level security;
alter table public.team_catalog enable row level security;
revoke all on public.team_catalog from anon,authenticated;
grant select on public.team_catalog to anon,authenticated;
grant all on public.team_catalog to service_role;
create policy public_read on public.team_catalog for select to anon,authenticated using(true);
revoke all on public.rating_seasons, public.rating_season_settings,
  public.team_season_participation, public.team_season_rating_seeds,
  public.team_season_rating_archive from anon, authenticated;
grant select on public.rating_seasons, public.rating_season_settings,
  public.team_season_participation, public.team_season_rating_seeds,
  public.team_season_rating_archive to anon, authenticated;
grant all on public.rating_seasons, public.rating_season_settings,
  public.team_season_participation, public.team_season_rating_seeds,
  public.team_season_rating_archive to service_role;
create policy public_read on public.rating_seasons for select to anon,authenticated using(true);
create policy public_read on public.rating_season_settings for select to anon,authenticated using(true);
create policy public_read on public.team_season_participation for select to anon,authenticated using(true);
create policy public_read on public.team_season_rating_seeds for select to anon,authenticated using(true);
create policy public_read on public.team_season_rating_archive for select to anon,authenticated using(true);

create view public.current_team_ratings with (security_invoker=true) as
select r.*,p.region,c.team->>'country' as country,c.team->>'logo' as logo
from public.team_ratings r
join public.rating_season_settings s on s.id
join public.rating_seasons season on season.season=s.active_season
left join public.team_season_participation p on p.season=s.active_season and p.team_id=r.team_id
left join public.team_catalog c on c.team_id=r.team_id
where season.rating_from is null or exists (
  select 1 from public.team_season_participation p
  where p.season=s.active_season and p.team_id=r.team_id and p.registered
);
grant select on public.current_team_ratings to anon,authenticated,service_role;

create function public.sync_season_participants(
  p_season integer, p_season_id text, p_teams jsonb,
  p_imports jsonb, p_expected_groups jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  old_season integer;
  old_count integer;
  new_count integer;
  switching boolean;
begin
  perform pg_advisory_xact_lock(59585859);
  select active_season into old_season from public.rating_season_settings where id for update;
  if p_season < old_season then raise exception 'Refusing season rollback'; end if;
  if jsonb_typeof(p_teams) <> 'array' or jsonb_array_length(p_teams)=0 then
    raise exception 'Empty season roster';
  end if;
  if jsonb_typeof(p_imports) <> 'array' or jsonb_typeof(p_expected_groups) <> 'array'
    or jsonb_array_length(p_expected_groups)=0
    or jsonb_array_length(p_imports)<>jsonb_array_length(p_expected_groups)
    or exists (select 1 from jsonb_array_elements_text(p_expected_groups) g(id)
      where not exists (select 1 from jsonb_array_elements(p_imports) i
        where i->>'entityId'=g.id and (i->>'rows')::int>0 and coalesce((i->>'invalidRows')::int,0)=0))
  then raise exception 'Incomplete season import'; end if;
  if exists (select 1 from jsonb_array_elements(p_teams) t
      where nullif(t->>'team_id','') is null or nullif(t->>'team_name','') is null
        or nullif(t->>'region','') is null
        or (t->>'division') not in ('Entry','Intermediate','Main','Advanced'))
    or (select count(distinct t->>'team_id') from jsonb_array_elements(p_teams) t)<>jsonb_array_length(p_teams)
  then raise exception 'Invalid or duplicate registrations'; end if;
  new_count := jsonb_array_length(p_teams);
  select count(*) into old_count from public.team_season_participation where season=p_season and registered;
  if old_count>0 and new_count < old_count*0.8 then
    raise exception 'Roster shrank by more than 20 percent; manual review required';
  end if;
  switching := p_season<>old_season;
  if switching then
    insert into public.team_season_rating_archive(season,team_id,world_rank,rating)
    select old_season,r.team_id,row_number() over(order by r.points desc,r.matches_played desc,r.team_id),to_jsonb(r)
    from public.current_team_ratings r on conflict do nothing;
  end if;
  insert into public.rating_seasons(season,season_id,rating_from,imported_at,imports)
  values(p_season,p_season_id,now(),now(),p_imports)
  on conflict(season) do update set imported_at=now(),imports=excluded.imports
  where public.rating_seasons.season_id=excluded.season_id;
  if not exists(select 1 from public.rating_seasons where season=p_season and season_id=p_season_id) then
    raise exception 'Season identity mismatch';
  end if;
  -- Keep all existing rating rows, names/URLs and history; only update registration metadata.
  insert into public.team_ratings(team_id,team_name,slug,division,points,previous_points,
    points_change,matches_played,ranking_status,updated_at)
  select t->>'team_id',t->>'team_name',t->>'slug',t->>'division',(t->>'initial_points')::int,
    (t->>'initial_points')::int,0,0,'unranked',now() from jsonb_array_elements(p_teams) t
  on conflict(team_id) do update set team_name=excluded.team_name,
    division=excluded.division,slug=coalesce(public.team_ratings.slug,excluded.slug);
  insert into public.team_catalog(team_id,team,updated_at)
  select t->>'team_id',jsonb_set(t->'runtime','{slug}',to_jsonb(r.slug)),now()
  from jsonb_array_elements(p_teams) t join public.team_ratings r on r.team_id=t->>'team_id'
  on conflict(team_id) do update set team=excluded.team,updated_at=now();
  -- Immutable seed: later recalculations replay only this season, never reapply old games.
  insert into public.team_season_rating_seeds(season,team_id,points,matches_played,ranking_status)
  select p_season,team_id,points,coalesce(matches_played,0),coalesce(ranking_status,'unranked')
  from public.team_ratings on conflict do nothing;
  update public.team_season_participation set registered=false where season=p_season;
  insert into public.team_season_participation(season,team_id,league_team_id,region,division,registered)
  select p_season,t->>'team_id',t->>'league_team_id',t->>'region',t->>'division',true
  from jsonb_array_elements(p_teams) t
  on conflict(season,team_id) do update set region=excluded.region,division=excluded.division,
    league_team_id=excluded.league_team_id,registered=true;
  update public.rating_season_settings set active_season=p_season where id;
  if switching then
    update public.team_ratings set previous_rank=null,rank_change=0,weekly_rank_change=0,
      weekly_points_change=0 where team_id in
      (select team_id from public.team_season_participation where season=p_season and registered);
  end if;
  return jsonb_build_object('season',p_season,'teams',new_count,'switched',switching,'archivedSeason',case when switching then old_season end);
end;
$$;
revoke all on function public.sync_season_participants(integer,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sync_season_participants(integer,text,jsonb,jsonb,jsonb) to service_role;

create function public.publish_season_ratings(p_season integer,p_rows jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
  perform pg_advisory_xact_lock(59585859);
  if p_season<>(select active_season from public.rating_season_settings where id) then
    raise exception 'Active season changed during rating replay; retry';
  end if;
  update public.team_ratings r set points=x.points,previous_points=x.previous_points,
    points_change=x.points_change,matches_played=x.matches_played,ranking_status=x.ranking_status,
    updated_at=now()
  from jsonb_to_recordset(p_rows) x(team_id text,points int,previous_points int,points_change int,
    matches_played int,ranking_status text)
  where r.team_id=x.team_id and exists(select 1 from public.current_team_ratings c where c.team_id=r.team_id);
  get diagnostics changed=row_count;
  return changed;
end;
$$;
revoke all on function public.publish_season_ratings(integer,jsonb) from public,anon,authenticated;
grant execute on function public.publish_season_ratings(integer,jsonb) to service_role;

-- Delta snapshots must not overwrite points read before a concurrent match replay.
create function public.publish_season_rating_deltas(p_season integer,p_rows jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
  perform pg_advisory_xact_lock(59585859);
  if p_season<>(select active_season from public.rating_season_settings where id) then
    raise exception 'Active season changed during delta snapshot; retry';
  end if;
  update public.team_ratings r set previous_rank=x.previous_rank,rank_change=x.rank_change,
    weekly_points_change=x.weekly_points_change,weekly_rank_change=x.weekly_rank_change,
    rating_snapshot_at=x.rating_snapshot_at
  from jsonb_to_recordset(p_rows) x(team_id text,previous_rank int,rank_change int,
    weekly_points_change int,weekly_rank_change int,rating_snapshot_at timestamptz)
  where r.team_id=x.team_id and exists(select 1 from public.current_team_ratings c where c.team_id=r.team_id);
  get diagnostics changed=row_count;
  return changed;
end;
$$;
revoke all on function public.publish_season_rating_deltas(integer,jsonb) from public,anon,authenticated;
grant execute on function public.publish_season_rating_deltas(integer,jsonb) to service_role;
