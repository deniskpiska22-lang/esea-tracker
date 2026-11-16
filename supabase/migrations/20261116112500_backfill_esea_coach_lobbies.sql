-- Reserve room in each batch for both live updates and the historical archive.
-- The existing function grants are preserved by CREATE OR REPLACE.
create or replace function public.esea_coach_lobbies_due()
returns table(id text, team1_id text, team2_id text, status text)
language sql stable security invoker set search_path = '' as $$
  (
    select m.id, m.team1_id, m.team2_id, m.status
    from public.matches m left join public.esea_coach_lobbies l on l.match_id = m.id
    where m.competition_name ~* '^(\s*ESEA\s|\s*S[0-9]+\s+(EU|NA|SA|AF|AS|OCE)\s)'
      and m.team1_id is not null and m.team2_id is not null
      and m.status in ('SCHEDULED','MATCH_STATUS_SCHEDULED','READY','MATCH_STATUS_READY',
        'ONGOING','MATCH_STATUS_ONGOING','LIVE','MATCH_STATUS_LIVE','CONFIGURING','MATCH_STATUS_CONFIGURING',
        'ADJUSTMENT','MATCH_STATUS_ADJUSTMENT')
      and m.scheduled_at between now() - interval '12 hours' and now() + interval '7 days'
      and (l.retry_at is null or l.retry_at <= now())
      and (l.checked_at is null or l.checked_at < now() - interval '3 hours')
    order by m.scheduled_at, m.id
    limit 48
  )
  union all
  (
    select m.id, m.team1_id, m.team2_id, m.status
    from public.matches m left join public.esea_coach_lobbies l on l.match_id = m.id
    where m.competition_name ~* '^(\s*ESEA\s|\s*S[0-9]+\s+(EU|NA|SA|AF|AS|OCE)\s)'
      and m.team1_id is not null and m.team2_id is not null
      and m.status in ('FINISHED','MATCH_STATUS_FINISHED')
      and coalesce(m.finished_at,m.scheduled_at) <= now()
      and not coalesce(l.terminal,false)
      and (l.retry_at is null or l.retry_at <= now())
    order by coalesce(m.finished_at,m.scheduled_at) desc, m.id
    limit 144
  )
$$;

revoke all on function public.esea_coach_lobbies_due() from public, anon, authenticated;
grant execute on function public.esea_coach_lobbies_due() to service_role;
