-- Preserve explicit game roles before later Data API updates replace raw_data.
create table public.esea_coach_match_rosters (
 match_id text primary key references public.matches(id) on delete cascade,
 payload jsonb not null,
 observed_at timestamptz not null default now(),
 processed_at timestamptz,
 retry_at timestamptz
);
alter table public.esea_coach_match_rosters enable row level security;
revoke all on public.esea_coach_match_rosters from public,anon,authenticated;
grant select,insert,update on public.esea_coach_match_rosters to service_role;
create index esea_coach_match_rosters_pending on public.esea_coach_match_rosters(match_id) where processed_at is null;

create function public.capture_esea_coach_match_roster() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status in ('FINISHED','MATCH_STATUS_FINISHED')
  and new.competition_name ~* '^(\s*ESEA\s|\s*S[0-9]+\s+(EU|NA|SA|AF|AS|OCE)\s)'
  and jsonb_typeof(new.raw_data->'factions')='array'
  and new.raw_data->>'id'=new.id and new.raw_data->>'game'='cs2' then
  insert into public.esea_coach_match_rosters(match_id,payload)
   values(new.id,jsonb_build_object('id',new.id,'game','cs2','status',new.status,
    'championship_id',new.raw_data->'championship_id','factions',new.raw_data->'factions'))
   on conflict(match_id) do update set payload=excluded.payload,observed_at=now(),processed_at=null,retry_at=null
   where esea_coach_match_rosters.payload is distinct from excluded.payload;
 end if;
 return new;
end;
$$;
revoke all on function public.capture_esea_coach_match_roster() from public,anon,authenticated;
create trigger capture_esea_coach_roles after insert or update of raw_data,status on public.matches
 for each row execute function public.capture_esea_coach_match_roster();
insert into public.esea_coach_match_rosters(match_id,payload)
 select m.id,jsonb_build_object('id',m.id,'game','cs2','status',m.status,
  'championship_id',m.raw_data->'championship_id','factions',m.raw_data->'factions')
 from public.matches m where m.status in ('FINISHED','MATCH_STATUS_FINISHED')
  and m.competition_name ~* '^(\s*ESEA\s|\s*S[0-9]+\s+(EU|NA|SA|AF|AS|OCE)\s)'
  and jsonb_typeof(m.raw_data->'factions')='array'
  and m.raw_data->>'id'=m.id and m.raw_data->>'game'='cs2';

create function public.esea_cached_coach_lobbies_due(p_limit integer default 1000)
returns table(id text,team1_id text,team2_id text,status text,competition_name text,payload jsonb)
language sql stable security invoker set search_path='' as $$
 select m.id,m.team1_id,m.team2_id,m.status,m.competition_name,r.payload
 from public.esea_coach_match_rosters r join public.matches m on m.id=r.match_id
 left join public.esea_coach_lobbies l on l.match_id=m.id
 where r.processed_at is null and (r.retry_at is null or r.retry_at<=now()) and not coalesce(l.terminal,false)
 order by m.id limit greatest(1,least(coalesce(p_limit,1000),2000))
$$;
revoke all on function public.esea_cached_coach_lobbies_due(integer) from public,anon,authenticated;
grant execute on function public.esea_cached_coach_lobbies_due(integer) to service_role;

create function public.esea_known_coach_identities(p_ids text[])
returns table(id text,nickname text,country text,avatar text)
language sql stable security invoker set search_path='' as $$
 with candidates as (
  select p.coach_id id,p.nickname,p.country,0 priority,p.observed_at stamp
   from public.esea_coach_roster_periods p where p.coach_id=any(p_ids)
  union all select p.faceit_id,p.nickname,p.country,1,null::timestamptz from public.players p where p.faceit_id=any(p_ids)
  union all select n.coach_id,n.nickname,null,2,null::timestamptz from public.esea_coach_names n where n.coach_id=any(p_ids)
 ), best as(select distinct on(c.id) c.* from candidates c order by c.id,c.priority,c.stamp desc nulls last,c.nickname)
 select b.id,b.nickname,coalesce(b.country,l.person->>'country'),l.person->>'avatar' from best b
 left join lateral (
  select c as person from public.esea_coach_lobbies r
   cross join lateral jsonb_array_elements(r.teams) t cross join lateral jsonb_array_elements(t->'coaches') c
   where r.coach_ids @> array[b.id] and c->>'id'=b.id order by r.checked_at desc limit 1
 ) l on true
$$;
revoke all on function public.esea_known_coach_identities(text[]) from public,anon,authenticated;
grant execute on function public.esea_known_coach_identities(text[]) to service_role;

create function public.record_esea_cached_coach_lobbies(p_snapshots jsonb,p_rejected text[] default '{}')
returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if jsonb_typeof(p_snapshots)<>'array' or jsonb_array_length(p_snapshots)>2000 then raise exception 'Invalid cached batch'; end if;
 insert into public.esea_coach_lobbies(match_id,team_ids,coach_ids,teams,checked_at,terminal,retry_at)
 select s.match_id,s.team_ids,s.coach_ids,s.teams,s.checked_at,true,null
 from jsonb_to_recordset(p_snapshots) s(match_id text,team_ids text[],coach_ids text[],teams jsonb,checked_at timestamptz)
 on conflict(match_id) do update set team_ids=excluded.team_ids,coach_ids=excluded.coach_ids,teams=excluded.teams,
  checked_at=excluded.checked_at,terminal=true,retry_at=null where not esea_coach_lobbies.terminal;
 get diagnostics n=row_count;
 update public.esea_coach_match_rosters set processed_at=now(),retry_at=null
  where match_id=any(p_rejected) or match_id in(select s->>'match_id' from jsonb_array_elements(p_snapshots) s);
 return n;
end;
$$;
revoke all on function public.record_esea_cached_coach_lobbies(jsonb,text[]) from public,anon,authenticated;
grant execute on function public.record_esea_cached_coach_lobbies(jsonb,text[]) to service_role;
