-- Standings have no roster unless --players was requested. An empty standings
-- payload must not erase profiles populated by scheduled matches or FACEIT.
create or replace function public.preserve_catalog_profile()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare ids jsonb; names jsonb;
begin
 if tg_op='UPDATE' and nullif(old.team->>'slug','') is not null then
  new.team:=jsonb_set(new.team,'{slug}',old.team->'slug');
 end if;
 if coalesce(jsonb_array_length(new.team->'playerIds'),0)=0 then
  select jsonb_agg(p.faceit_id order by l.joined_at,l.id),jsonb_agg(p.nickname order by l.joined_at,l.id)
   into ids,names from public.team_players l join public.players p on p.id=l.player_id
   where l.team_id=new.team_id and l.is_active and p.faceit_id is not null;
  if ids is not null then
   new.team:=new.team||jsonb_build_object('playerIds',ids,'players',names);
  elsif tg_op='UPDATE' and coalesce(jsonb_array_length(old.team->'playerIds'),0)>0 then
   new.team:=new.team||jsonb_build_object('playerIds',old.team->'playerIds','players',old.team->'players');
  end if;
 end if;
 return new;
end $$;
revoke all on function public.preserve_catalog_profile() from public,anon,authenticated;
create trigger preserve_catalog_profile before insert or update of team on public.team_catalog
 for each row execute function public.preserve_catalog_profile();
-- Restore catalog identities that the last standings refresh cleared.
update public.team_catalog c set team=c.team where coalesce(jsonb_array_length(c.team->'playerIds'),0)=0
 and exists(select 1 from public.team_players l where l.team_id=c.team_id and l.is_active);
