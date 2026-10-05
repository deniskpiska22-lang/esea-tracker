-- Workers persist an authoritative FACEIT roster in one transaction/request.
-- Public clients cannot write roster membership through this function.
create or replace function public.sync_registered_team_roster(p_team_id text,p_members jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare expected int; valid int;
begin
 if jsonb_typeof(p_members) is distinct from 'array' then return '{"skipped":true}'::jsonb; end if;
 expected:=jsonb_array_length(p_members);
 select count(*) into valid from jsonb_array_elements(p_members) p
  where p->>'faceit_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and nullif(p->>'nickname','') is not null;
 if expected=0 or valid<>expected then return '{"skipped":true,"reason":"invalid_roster"}'::jsonb; end if;
 insert into public.players(faceit_id,nickname,avatar,country,steam_id,faceit_elo,faceit_level,updated_at)
 select faceit_id,nickname,avatar,country,steam_id,faceit_elo,faceit_level,now()
 from jsonb_to_recordset(p_members) as p(faceit_id text,nickname text,avatar text,country text,steam_id text,faceit_elo int,faceit_level int)
 on conflict(faceit_id) do update set nickname=excluded.nickname,
  avatar=coalesce(excluded.avatar,players.avatar),country=coalesce(excluded.country,players.country),
  steam_id=coalesce(excluded.steam_id,players.steam_id),faceit_elo=coalesce(excluded.faceit_elo,players.faceit_elo),
  faceit_level=coalesce(excluded.faceit_level,players.faceit_level),updated_at=now()
 where (players.nickname,players.avatar,players.country,players.steam_id,players.faceit_elo,players.faceit_level)
 is distinct from (excluded.nickname,coalesce(excluded.avatar,players.avatar),coalesce(excluded.country,players.country),
 coalesce(excluded.steam_id,players.steam_id),coalesce(excluded.faceit_elo,players.faceit_elo),coalesce(excluded.faceit_level,players.faceit_level));
 insert into public.team_players(team_id,player_id,is_active,joined_at,left_at)
 select p_team_id,p.id,true,coalesce(l.joined_at,now()),null
 from public.players p left join public.team_players l on l.team_id=p_team_id and l.player_id=p.id
 where p.faceit_id in (select m->>'faceit_id' from jsonb_array_elements(p_members) m)
 on conflict(team_id,player_id) do update set is_active=true,left_at=null,joined_at=coalesce(team_players.joined_at,excluded.joined_at);
 update public.team_players l set is_active=false,left_at=now()
 where l.team_id=p_team_id and l.is_active and l.player_id not in
  (select p.id from public.players p where p.faceit_id in (select m->>'faceit_id' from jsonb_array_elements(p_members) m));
 update public.team_catalog set team=team||jsonb_build_object('playerIds',(select jsonb_agg(m->>'faceit_id') from jsonb_array_elements(p_members) m),
 'players',(select jsonb_agg(m->>'nickname') from jsonb_array_elements(p_members) m)),updated_at=now() where team_id=p_team_id
 and (team->'playerIds',team->'players') is distinct from
 ((select jsonb_agg(m->>'faceit_id') from jsonb_array_elements(p_members) m),(select jsonb_agg(m->>'nickname') from jsonb_array_elements(p_members) m));
 return jsonb_build_object('members',expected,'skipped',false);
end $$;
revoke all on function public.sync_registered_team_roster(text,jsonb) from public,anon,authenticated;
grant execute on function public.sync_registered_team_roster(text,jsonb) to service_role;
