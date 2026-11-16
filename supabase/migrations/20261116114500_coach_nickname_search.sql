create table public.esea_coach_names (
  coach_id text not null,
  normalized_name text not null,
  nickname text not null,
  primary key (coach_id, normalized_name)
);

alter table public.esea_coach_names enable row level security;
revoke all on public.esea_coach_names from public, anon, authenticated;
grant select, insert on public.esea_coach_names to service_role;

create function public.index_esea_coach_names()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.esea_coach_names (coach_id, normalized_name, nickname)
  select c->>'id', lower(c->>'nickname'), c->>'nickname'
  from jsonb_array_elements(new.teams) t
  cross join lateral jsonb_array_elements(t->'coaches') c
  where c->>'id' = any(new.coach_ids) and c->>'nickname' <> ''
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.index_esea_coach_names() from public, anon, authenticated;
grant execute on function public.index_esea_coach_names() to service_role;
create trigger esea_coach_names_from_room
after insert or update of teams on public.esea_coach_lobbies
for each row when (cardinality(new.coach_ids) > 0) execute function public.index_esea_coach_names();

insert into public.esea_coach_names (coach_id, normalized_name, nickname)
select c->>'id', lower(c->>'nickname'), c->>'nickname'
from public.esea_coach_lobbies l
cross join lateral jsonb_array_elements(l.teams) t
cross join lateral jsonb_array_elements(t->'coaches') c
where c->>'id' = any(l.coach_ids) and c->>'nickname' <> ''
on conflict do nothing;

create function public.find_esea_coaches(p_query text)
returns table(id text, nickname text)
language sql stable security invoker set search_path = '' as $$
  select n.coach_id, n.nickname
  from (
    select distinct on (c.coach_id) c.coach_id, c.nickname, c.normalized_name,
      case when c.normalized_name = lower(p_query) then 0
           when starts_with(c.normalized_name, lower(p_query)) then 1 else 2 end as priority
    from public.esea_coach_names c
    where char_length(p_query) between 2 and 80 and strpos(c.normalized_name, lower(p_query)) > 0
      and exists (select 1 from public.esea_coach_lobbies l
        where l.coach_ids @> array[c.coach_id]
          and (l.terminal or l.checked_at >= now() - interval '8 hours'))
    order by c.coach_id, priority, c.normalized_name
  ) n
  order by n.priority, n.normalized_name, n.coach_id
  limit 8
$$;
revoke all on function public.find_esea_coaches(text) from public, anon, authenticated;
grant execute on function public.find_esea_coaches(text) to service_role;

create function public.esea_coach_player_identities(p_ids text[])
returns table(id text, nickname text)
language sql stable security invoker set search_path = '' as $$
  select p.faceit_id, p.nickname
  from public.players p
  where cardinality(p_ids) between 1 and 8 and p.faceit_id = any(p_ids)
    and p.nickname <> ''
    and (exists (select 1 from public.player_ratings r where r.player_id = p.faceit_id and r.matches_played > 0)
      or exists (select 1 from public.match_player_stats s where s.faceit_player_id = p.faceit_id))
$$;
revoke all on function public.esea_coach_player_identities(text[]) from public, anon, authenticated;
grant execute on function public.esea_coach_player_identities(text[]) to service_role;
