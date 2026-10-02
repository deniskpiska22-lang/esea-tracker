alter table public.team_season_participation drop constraint team_season_participation_division_check;
alter table public.team_season_participation add constraint team_season_participation_division_check
check (division in ('Entry','Intermediate','Main','Advanced') or (division='Open10' and region='Europe'));

CREATE OR REPLACE FUNCTION public.sync_season_participants(p_season integer, p_season_id text, p_teams jsonb, p_imports jsonb, p_expected_groups jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
        or (t->>'division') not in ('Entry','Intermediate','Main','Advanced','Open10')
        or (t->>'division'='Open10' and t->>'region'<>'Europe')
        or t->>'region' in ('Asia','Oceania'))
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
$function$;
