-- A one-way checkpoint for explicitly opted-in manual tenures. Roster membership
-- alone cannot release the override. Keep the checkpoint if a lobby changes later.
create table public.esea_coach_assignment_handoffs (
  coach_id text not null,
  team_id text not null,
  started_at timestamptz not null,
  identity_ids text[] not null,
  confirmed_at timestamptz,
  handoff_at timestamptz,
  confirmed_match_id text,
  confirmed_team_id text,
  primary key (coach_id,team_id,started_at),
  check (coach_id = any(identity_ids)),
  check ((confirmed_at is null and handoff_at is null and confirmed_match_id is null and confirmed_team_id is null)
    or (confirmed_at is not null and handoff_at is not null and handoff_at >= started_at and handoff_at <= confirmed_at
      and confirmed_match_id is not null and confirmed_team_id is not null))
);
alter table public.esea_coach_assignment_handoffs enable row level security;
revoke all on public.esea_coach_assignment_handoffs from public,anon,authenticated;
grant select,insert,update on public.esea_coach_assignment_handoffs to service_role;

-- Matches the owner's handoffOnCoachLobby assignment in server/coachAssignments.js.
insert into public.esea_coach_assignment_handoffs(coach_id,team_id,started_at,identity_ids)
values('0871c9f5-cacc-460e-a44a-c85bb414ad5b','dcb2f3b3-72b5-4e7a-b8c5-921e1c3eeee4',
 '2026-11-07T00:00:00Z',array['0871c9f5-cacc-460e-a44a-c85bb414ad5b','f90b8c34-3324-4686-b078-ab86c5e14f40']);

create function public.record_esea_coach_assignment_handoff(p_match_id text)
returns void language sql security invoker set search_path = '' as $$
  update public.esea_coach_assignment_handoffs h
  set confirmed_at=l.checked_at,
      handoff_at=least(coalesce(case when m.started_at > '2000-01-01'::timestamptz then m.started_at end,
        case when m.scheduled_at > '2000-01-01'::timestamptz then m.scheduled_at end,m.finished_at),l.checked_at),
      confirmed_match_id=l.match_id,
      confirmed_team_id=(select side->>'id' from jsonb_array_elements(l.teams) side
        where side->>'id' in (m.team1_id,m.team2_id)
        and exists(select 1 from jsonb_array_elements(coalesce(side->'coaches','[]'::jsonb)) person
          where person->>'id'=any(h.identity_ids)) limit 1)
  from public.esea_coach_lobbies l join public.matches m on m.id=l.match_id
  where l.match_id=p_match_id and h.confirmed_at is null
    and l.coach_ids && h.identity_ids and l.checked_at between h.started_at and now() + interval '5 minutes'
    and coalesce(case when m.started_at > '2000-01-01'::timestamptz then m.started_at end,
      case when m.scheduled_at > '2000-01-01'::timestamptz then m.scheduled_at end,m.finished_at) >= h.started_at
    and m.competition_name ~* '^(\s*ESEA\s|\s*S[0-9]+\s+(EU|NA|SA|AF|AS|OCE)\s)'
    and ((l.terminal and m.status in ('FINISHED','MATCH_STATUS_FINISHED'))
      or (not l.terminal and l.checked_at >= now()-interval '8 hours'
        and coalesce(m.started_at,m.scheduled_at,m.finished_at) >= now()-interval '12 hours'
        and m.status in ('SCHEDULED','MATCH_STATUS_SCHEDULED','READY','MATCH_STATUS_READY',
          'ONGOING','MATCH_STATUS_ONGOING','LIVE','MATCH_STATUS_LIVE','CONFIGURING',
          'MATCH_STATUS_CONFIGURING','ADJUSTMENT','MATCH_STATUS_ADJUSTMENT')))
    and (select count(*) from jsonb_array_elements(l.teams) side
      where side->>'id' in (m.team1_id,m.team2_id)
      and exists(select 1 from jsonb_array_elements(coalesce(side->'coaches','[]'::jsonb)) person
        where person->>'id'=any(h.identity_ids)))=1;
$$;
revoke all on function public.record_esea_coach_assignment_handoff(text) from public,anon,authenticated;
grant execute on function public.record_esea_coach_assignment_handoff(text) to service_role;

create function public.capture_esea_coach_assignment_handoff()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform public.record_esea_coach_assignment_handoff(new.match_id);
  return new;
end;
$$;
revoke all on function public.capture_esea_coach_assignment_handoff() from public,anon,authenticated;
grant execute on function public.capture_esea_coach_assignment_handoff() to service_role;
create trigger capture_coach_assignment_handoff
 after insert or update of teams,coach_ids,terminal,checked_at on public.esea_coach_lobbies
 for each row execute function public.capture_esea_coach_assignment_handoff();

-- Existing explicit coach rooms can establish the checkpoint; older seasons cannot.
select public.record_esea_coach_assignment_handoff(l.match_id)
from public.esea_coach_lobbies l join public.matches m on m.id=l.match_id
where l.coach_ids && array['0871c9f5-cacc-460e-a44a-c85bb414ad5b','f90b8c34-3324-4686-b078-ab86c5e14f40']
order by coalesce(m.started_at,m.scheduled_at,m.finished_at),l.checked_at,l.match_id;
