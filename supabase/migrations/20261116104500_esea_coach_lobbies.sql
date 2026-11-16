create table public.esea_coach_lobbies (
  match_id text primary key references public.matches(id) on delete cascade,
  team_ids text[] not null default '{}',
  coach_ids text[] not null default '{}',
  teams jsonb not null default '[]' check (jsonb_typeof(teams) = 'array'),
  checked_at timestamptz not null default now(),
  retry_at timestamptz,
  terminal boolean not null default false
);
alter table public.esea_coach_lobbies enable row level security;
revoke all on public.esea_coach_lobbies from public, anon, authenticated;
grant select, insert, update on public.esea_coach_lobbies to service_role;
create index esea_coach_lobbies_teams_idx on public.esea_coach_lobbies using gin(team_ids);
create index esea_coach_lobbies_coaches_idx on public.esea_coach_lobbies using gin(coach_ids);

create function public.esea_coach_lobbies_due()
returns table(id text, team1_id text, team2_id text, status text)
language sql stable security invoker set search_path = '' as $$
  select m.id, m.team1_id, m.team2_id, m.status
  from public.matches m
  left join public.esea_coach_lobbies l on l.match_id = m.id
  where m.competition_name ~* '^(\s*ESEA\s|\s*S[0-9]+\s+(EU|NA|SA|AF|AS|OCE)\s)'
    and m.team1_id is not null and m.team2_id is not null
    and coalesce(m.finished_at,m.scheduled_at) between now() - interval '120 days' and now() + interval '7 days'
    and (l.retry_at is null or l.retry_at <= now())
    and ((m.status in ('FINISHED','MATCH_STATUS_FINISHED') and not coalesce(l.terminal,false))
      or (m.status in ('SCHEDULED','MATCH_STATUS_SCHEDULED','READY','MATCH_STATUS_READY',
        'ONGOING','MATCH_STATUS_ONGOING','LIVE','MATCH_STATUS_LIVE','CONFIGURING','MATCH_STATUS_CONFIGURING',
        'ADJUSTMENT','MATCH_STATUS_ADJUSTMENT') and m.scheduled_at >= now() - interval '12 hours'
        and (l.checked_at is null or l.checked_at < now() - interval '3 hours')))
  order by (m.scheduled_at between now() - interval '1 day' and now() + interval '7 days') desc nulls last,
    coalesce(l.checked_at, '-infinity'::timestamptz), coalesce(m.finished_at,m.scheduled_at) desc, m.id
  limit 120
$$;
revoke all on function public.esea_coach_lobbies_due() from public, anon, authenticated;
grant execute on function public.esea_coach_lobbies_due() to service_role;

create function public.esea_latest_coach_lobby(p_team_id text)
returns table(match_id text, observed_at timestamptz, teams jsonb)
language sql stable security invoker set search_path = '' as $$
  select l.match_id, coalesce(m.finished_at, m.scheduled_at), l.teams
  from public.esea_coach_lobbies l join public.matches m on m.id = l.match_id
  where l.team_ids @> array[p_team_id]
    and ((l.terminal and m.status in ('FINISHED','MATCH_STATUS_FINISHED')
          and coalesce(m.finished_at, m.scheduled_at) >= now() - interval '45 days')
      or (not l.terminal and l.checked_at >= now() - interval '8 hours'
          and m.scheduled_at between now() - interval '12 hours' and now() + interval '24 hours'
          and m.status in ('SCHEDULED','MATCH_STATUS_SCHEDULED','READY','MATCH_STATUS_READY',
             'ONGOING','MATCH_STATUS_ONGOING','LIVE','MATCH_STATUS_LIVE','CONFIGURING',
             'MATCH_STATUS_CONFIGURING','ADJUSTMENT','MATCH_STATUS_ADJUSTMENT')))
  order by case when l.terminal then 1 else 0 end,
           case when not l.terminal then abs(extract(epoch from m.scheduled_at - now())) end,
           coalesce(m.finished_at,m.scheduled_at) desc, l.match_id
  limit 1
$$;
revoke all on function public.esea_latest_coach_lobby(text) from public, anon, authenticated;
grant execute on function public.esea_latest_coach_lobby(text) to service_role;
