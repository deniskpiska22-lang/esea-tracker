-- A scheduled FACEIT match already contains identities; statistics are optional.
create or replace function public.seed_discovered_player_profiles(payload jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare faction jsonb; member jsonb; tid text; pid uuid; ids text[]; names text[];
begin
  if jsonb_typeof(payload->'teams') is distinct from 'object' then return; end if;
  for faction in select value from jsonb_each(coalesce(payload->'teams','{}'::jsonb)) loop
    tid := faction->>'faction_id';
    if tid is null or not exists(select 1 from team_catalog where team_id=tid) then continue; end if;
    if jsonb_typeof(faction->'roster') is distinct from 'array' then continue; end if;
    ids := '{}'; names := '{}';
    for member in select value from jsonb_array_elements(faction->'roster') loop
      if coalesce(member->>'player_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or nullif(member->>'nickname','') is null then continue; end if;
      insert into players(faceit_id,nickname,avatar,steam_id,faceit_level)
      values(member->>'player_id',member->>'nickname',member->>'avatar',member->>'game_player_id',
        case when member->>'game_skill_level' ~ '^[0-9]{1,2}$' then (member->>'game_skill_level')::int else null end)
      on conflict(faceit_id) do nothing;
      select id into pid from players where faceit_id=member->>'player_id';
      ids := array_append(ids,member->>'player_id'); names := array_append(names,member->>'nickname');
      -- Seed only previously unknown rosters. Historical matches must not reactivate former players.
      if coalesce((select jsonb_array_length(team->'playerIds') from team_catalog where team_id=tid),0)=0 then
        insert into team_players(team_id,player_id,is_active) values(tid,pid,true)
        on conflict(team_id,player_id) do nothing;
      end if;
    end loop;
    if cardinality(ids)>0 then
      update team_catalog set team=team || jsonb_build_object('playerIds',to_jsonb(ids),'players',to_jsonb(names)),updated_at=now()
      where team_id=tid and coalesce(jsonb_array_length(team->'playerIds'),0)=0;
    end if;
  end loop;
end $$;
revoke all on function public.seed_discovered_player_profiles(jsonb) from public,anon,authenticated;
create or replace function public.on_discovered_player_profiles()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.seed_discovered_player_profiles(new.raw_data);
 return new;
end $$;
revoke all on function public.on_discovered_player_profiles() from public,anon,authenticated;
create trigger seed_discovered_player_profiles
 after insert or update of raw_data on public.matches
 for each row when (new.raw_data is not null)
 execute function public.on_discovered_player_profiles();
-- One latest known roster per catalog team; no updates to match history.
do $$
declare roster_row record;
begin
 for roster_row in
  select distinct on (f.value->>'faction_id') f.value as faction
  from matches m cross join lateral jsonb_each(case when jsonb_typeof(m.raw_data->'teams')='object' then m.raw_data->'teams' else '{}'::jsonb end) f
  join team_catalog c on c.team_id=f.value->>'faction_id'
  where jsonb_typeof(f.value->'roster')='array' and jsonb_array_length(f.value->'roster')>0
  order by f.value->>'faction_id',m.scheduled_at desc nulls last
 loop
  perform public.seed_discovered_player_profiles(jsonb_build_object('teams',jsonb_build_object('faction',roster_row.faction)));
 end loop;
end $$;
