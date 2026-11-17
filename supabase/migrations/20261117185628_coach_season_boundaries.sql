create table public.esea_coach_season_bounds (
  team_id text not null,
  season integer not null check (season >= 57),
  coach_id text not null,
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  primary key (team_id, season, coach_id)
);
alter table public.esea_coach_season_bounds enable row level security;
revoke all on public.esea_coach_season_bounds from public, anon, authenticated;
grant select, insert, update on public.esea_coach_season_bounds to service_role;
create index esea_coach_season_bounds_coach_idx on public.esea_coach_season_bounds(coach_id);

create function public.esea_coach_boundary_groups(p_after text default '', p_limit integer default 10)
returns table(key text, team_id text, season integer, matches jsonb)
language sql stable security invoker set search_path = '' as $$
  with eligible as materialized (
    select m.id,m.status,m.team1_id,m.team2_id,
      coalesce(m.started_at,m.scheduled_at,m.finished_at) as date,
      substring(m.competition_name from '(?i)(?:season\s*|s)([0-9]+)')::integer as season
    from public.matches m
    where m.status in ('FINISHED','MATCH_STATUS_FINISHED')
      and m.competition_name ~* '^(\s*ESEA\s|\s*S[0-9]+\s+(EU|NA|SA|AF|AS|OCE)\s)'
      and m.team1_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      and m.team2_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      and greatest(coalesce(m.team1_score,0),coalesce(m.team2_score,0)) > 1
      and coalesce(m.started_at,m.scheduled_at,m.finished_at) <= now()
  ), sides as materialized (
    select e.*,t.team_id,e.season::text || ':' || t.team_id as key
    from eligible e cross join lateral (values (e.team1_id),(e.team2_id)) t(team_id)
    where e.season >= 57
  ), groups as (
    select s.key,s.team_id,s.season from sides s
    where s.key > coalesce(p_after,'')
    group by s.key,s.team_id,s.season order by s.key
    limit greatest(1,least(coalesce(p_limit,10),100))
  )
  select g.key,g.team_id,g.season,
    jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'team1_id',s.team1_id,'team2_id',s.team2_id,
      'date',s.date,'known',coalesce(l.terminal and l.team_ids @> array[g.team_id],false),
      'retry_at',l.retry_at,'coaches',coalesce((
        select jsonb_agg(c->>'id') from jsonb_array_elements(l.teams) t
        cross join lateral jsonb_array_elements(t->'coaches') c
        where t->>'id'=g.team_id
      ),'[]'::jsonb)) order by s.date,s.id)
  from groups g join sides s on s.key=g.key
  left join public.esea_coach_lobbies l on l.match_id=s.id
  group by g.key,g.team_id,g.season order by g.key
$$;
revoke all on function public.esea_coach_boundary_groups(text,integer) from public,anon,authenticated;
grant execute on function public.esea_coach_boundary_groups(text,integer) to service_role;
