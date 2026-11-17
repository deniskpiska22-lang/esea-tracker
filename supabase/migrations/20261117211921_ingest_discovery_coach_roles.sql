create function public.capture_esea_discovery_coach_roles(p_rows jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>200 then raise exception 'Invalid discovery batch'; end if;
 insert into public.esea_coach_match_rosters(match_id,payload)
 select m.id,x.payload from jsonb_to_recordset(p_rows) x(id text,payload jsonb)
 join public.matches m on m.id=x.id
 where m.status in ('FINISHED','MATCH_STATUS_FINISHED')
  and m.competition_name ~* '^(\s*ESEA\s|\s*S[0-9]+\s+(EU|NA|SA|AF|AS|OCE)\s)'
  and x.payload->>'id'=m.id and x.payload->>'game'='cs2'
  and jsonb_typeof(x.payload->'factions')='array'
 on conflict(match_id) do update set payload=excluded.payload,observed_at=now(),processed_at=null,retry_at=null
  where esea_coach_match_rosters.payload is distinct from excluded.payload;
 get diagnostics n=row_count;
 return n;
end;
$$;
revoke all on function public.capture_esea_discovery_coach_roles(jsonb) from public,anon,authenticated;
grant execute on function public.capture_esea_discovery_coach_roles(jsonb) to service_role;
