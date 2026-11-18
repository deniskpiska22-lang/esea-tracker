create or replace function public.get_player_leaderboard(
  p_division text default null, p_region text default null,
  p_min_matches integer default 5, p_search text default ''
) returns setof jsonb language sql stable security invoker set search_path = '' as $$
  with candidates as (
    select r.*, coalesce(nullif(p.nickname,''),r.nickname) public_nickname,
      p.country, p.faceit_elo, c.team_id, c.team,
      coalesce(nullif(c.team->>'region',''), source.region) league_region
    from public.player_ratings r
    left join public.players p on p.faceit_id=r.player_id
    left join lateral (
      select tc.team_id,tc.team from public.team_players tp
      join public.team_catalog tc on tc.team_id=tp.team_id
      where tp.player_id=p.id and tp.is_active=true
      order by tp.joined_at desc nulls last,tp.id limit 1
    ) c on true
    left join lateral (
      select s.value->>'region' region from jsonb_array_elements(coalesce(c.team->'sources','[]'::jsonb)) s(value)
      where s.value->>'region' is not null
      order by coalesce(s.value->>'season','') desc, s.value->>'region' limit 1
    ) source on true
    where r.rating > 0 and r.rating < 100
      and r.matches_played >= least(greatest(coalesce(p_min_matches,5),5),100)
  ), filtered as (
    select * from candidates
    where (nullif(p_division,'') is null or team->>'division'=p_division)
      and (nullif(p_region,'') is null or league_region=p_region)
  ), ranked as (
    select *, row_number() over(order by rating desc,matches_played desc,player_id) position from filtered
  )
  select jsonb_build_object(
    'player_id',player_id,'nickname',public_nickname,'country',country,
    'rating',rating,'recent_rating',recent_rating,'matches_played',matches_played,'maps_played',maps_played,
    'adr',adr,'kd',kd,'faceit_elo',faceit_elo,'updated_at',updated_at,'position',position,
    'team_id',team_id,'team_name',team->>'name','team_slug',team->>'slug','team_logo',team->>'logo',
    'division',team->>'division','region',league_region
  ) from ranked
  where (nullif(btrim(p_search),'') is null
    or strpos(lower(public_nickname),lower(left(btrim(p_search),80)))>0)
  order by rating desc,matches_played desc,player_id limit 100;
$$;
revoke all on function public.get_player_leaderboard(text,text,integer,text) from public;
grant execute on function public.get_player_leaderboard(text,text,integer,text) to anon,authenticated,service_role;
