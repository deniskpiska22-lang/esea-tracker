-- Public readers keep existing table RLS; no privileged data is exposed.
create index if not exists matches_player_stats_gin_idx
 on public.matches using gin (player_stats jsonb_path_ops)
 where status in ('FINISHED','MATCH_STATUS_FINISHED');

create or replace function public.get_player_match_history(p_player_id text)
returns setof jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'id',m.id,'competition_name',m.competition_name,'status',m.status,
 'scheduled_at',m.scheduled_at,'finished_at',m.finished_at,
 'team1_id',m.team1_id,'team1_name',m.team1_name,'team1_score',m.team1_score,
 'team2_id',m.team2_id,'team2_name',m.team2_name,'team2_score',m.team2_score,
 'map_scores',m.map_scores,'player_stats',m.player_stats,'stats_synced',m.stats_synced)
 from public.matches m
 where m.status in ('FINISHED','MATCH_STATUS_FINISHED') and (
 m.player_stats @> jsonb_build_object('teams',jsonb_build_array(jsonb_build_object('players',jsonb_build_array(jsonb_build_object('playerId',p_player_id)))))
 or m.player_stats @> jsonb_build_object('teams',jsonb_build_array(jsonb_build_object('players',jsonb_build_array(jsonb_build_object('player_id',p_player_id)))))
 or m.player_stats @> jsonb_build_object('teams',jsonb_build_array(jsonb_build_object('players',jsonb_build_array(jsonb_build_object('faceit_id',p_player_id)))))
 ) order by coalesce(m.finished_at,m.scheduled_at) desc nulls last,m.id;
$$;

create or replace function public.get_top_player_ratings(p_limit integer default 100, p_offset integer default 0)
returns setof jsonb language sql stable security invoker set search_path = '' as $$
 select to_jsonb(r) || jsonb_build_object('avatar',p.avatar,'team_id',t.team_id,
 'team_name',t.team->>'name','team_slug',t.team->>'slug','division',t.team->>'division')
 from (select * from public.player_ratings where rating is not null and matches_played >= 5
 order by rating desc,matches_played desc,player_id
 limit least(greatest(p_limit,1),200) offset greatest(p_offset,0)) r
 left join public.players p on p.faceit_id=r.player_id
 left join lateral (
 select c.team_id,c.team from public.team_players tp
 join public.team_catalog c on c.team_id=tp.team_id
 where tp.player_id=p.id and tp.is_active=true
 order by tp.joined_at desc nulls last,tp.id limit 1
 ) t on true order by r.rating desc,r.matches_played desc,r.player_id;
$$;
revoke all on function public.get_player_match_history(text) from public;
revoke all on function public.get_top_player_ratings(integer,integer) from public;
grant execute on function public.get_player_match_history(text),public.get_top_player_ratings(integer,integer) to anon,authenticated,service_role;
