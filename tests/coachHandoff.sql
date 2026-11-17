-- Integration test against a populated tracker database. All fixture writes roll back.
begin;
do $$
declare
  m public.matches%rowtype;
  checkpoint public.esea_coach_assignment_handoffs%rowtype;
  owner_id text := '0871c9f5-cacc-460e-a44a-c85bb414ad5b';
  alias_id text := 'f90b8c34-3324-4686-b078-ab86c5e14f40';
  team_id text := 'dcb2f3b3-72b5-4e7a-b8c5-921e1c3eeee4';
  observed timestamptz := clock_timestamp();
begin
  select * into strict m from public.matches
    where (team1_id=team_id or team2_id=team_id) and status in ('FINISHED','MATCH_STATUS_FINISHED')
      and coalesce(started_at,scheduled_at,finished_at) >= '2026-11-07'::timestamptz
    order by coalesce(started_at,scheduled_at,finished_at),id limit 1;
  update public.esea_coach_assignment_handoffs set confirmed_at=null,handoff_at=null,
    confirmed_match_id=null,confirmed_team_id=null where coach_id=owner_id;

  -- An indexed identity, substitute/player entry or another coach is insufficient.
  insert into public.esea_coach_lobbies(match_id,team_ids,coach_ids,teams,terminal,checked_at)
    values(m.id,array[m.team1_id,m.team2_id],array[owner_id],
      jsonb_build_array(jsonb_build_object('id',team_id,'coaches','[]'::jsonb,
        'roster',jsonb_build_array(jsonb_build_object('id',owner_id,'role','GAME_ROLE_SUBSTITUTE')))),true,observed)
    on conflict(match_id) do update set team_ids=excluded.team_ids,coach_ids=excluded.coach_ids,
      teams=excluded.teams,terminal=excluded.terminal,checked_at=excluded.checked_at;
  assert (select confirmed_at is null from public.esea_coach_assignment_handoffs where coach_id=owner_id), 'player role released manual override';
  update public.esea_coach_lobbies set teams=jsonb_build_array(jsonb_build_object('id',team_id,
    'coaches',jsonb_build_array(jsonb_build_object('id','another-coach')))) where match_id=m.id;
  assert (select confirmed_at is null from public.esea_coach_assignment_handoffs where coach_id=owner_id), 'different coach released manual override';

  -- Linked FACEIT identities are recognized only inside the actual coach slot.
  update public.esea_coach_lobbies set coach_ids=array[alias_id],teams=jsonb_build_array(jsonb_build_object('id',team_id,
    'coaches',jsonb_build_array(jsonb_build_object('id',alias_id)))) where match_id=m.id;
  select * into strict checkpoint from public.esea_coach_assignment_handoffs where coach_id=owner_id;
  assert checkpoint.confirmed_match_id=m.id and checkpoint.confirmed_team_id=team_id and checkpoint.confirmed_at=observed, 'coach slot was not captured';

  -- A later empty room cannot undo or move the one-way checkpoint.
  update public.esea_coach_lobbies set coach_ids='{}',teams='[]',checked_at=observed+interval '1 minute' where match_id=m.id;
  assert (select confirmed_at=checkpoint.confirmed_at and handoff_at=checkpoint.handoff_at
    and confirmed_match_id=checkpoint.confirmed_match_id from public.esea_coach_assignment_handoffs where coach_id=owner_id), 'checkpoint changed after room overwrite';
  -- A fresh upcoming room also releases immediately, without waiting for results.
  update public.esea_coach_assignment_handoffs set confirmed_at=null,handoff_at=null,
    confirmed_match_id=null,confirmed_team_id=null where coach_id=owner_id;
  update public.matches set status='READY',started_at=null,finished_at=null,
    scheduled_at=observed+interval '1 hour' where id=m.id;
  update public.esea_coach_lobbies set terminal=false,checked_at=observed,coach_ids=array[owner_id],
    teams=jsonb_build_array(jsonb_build_object('id',team_id,
      'coaches',jsonb_build_array(jsonb_build_object('id',owner_id)))) where match_id=m.id;
  assert (select confirmed_at=observed and handoff_at=observed from public.esea_coach_assignment_handoffs where coach_id=owner_id), 'fresh upcoming room did not release immediately';

  update public.esea_coach_assignment_handoffs set confirmed_at=null,handoff_at=null,
    confirmed_match_id=null,confirmed_team_id=null where coach_id=owner_id;
  update public.esea_coach_lobbies set checked_at=observed-interval '9 hours' where match_id=m.id;
  assert (select confirmed_at is null from public.esea_coach_assignment_handoffs where coach_id=owner_id), 'stale upcoming room released manual override';
  assert not has_table_privilege('anon','public.esea_coach_assignment_handoffs','select'), 'checkpoint leaked to public client';
  assert not has_function_privilege('anon','public.record_esea_coach_assignment_handoff(text)','execute'), 'public handoff writes allowed';
end;
$$;
select 'Coach lobby handoff integration checks passed; fixture writes rolled back' as result;
rollback;
