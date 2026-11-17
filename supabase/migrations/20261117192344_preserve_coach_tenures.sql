-- Keep each stint, including returns to the same team. Do not cascade-delete history.
create table public.esea_coach_roster_periods (
  id uuid primary key default gen_random_uuid(),
  team_id text not null,
  season integer not null,
  coach_id text not null,
  nickname text not null,
  country text,
  source_started_at timestamptz,
  period_started_at timestamptz not null,
  start_source text not null check (start_source in ('league_membership','first_observed')),
  first_seen_at timestamptz not null,
  observed_at timestamptz not null,
  ended_at timestamptz,
  active boolean not null,
  team_snapshot jsonb not null,
  check (observed_at >= first_seen_at),
  check (ended_at is null or ended_at >= period_started_at)
);
create unique index esea_coach_period_active_team on public.esea_coach_roster_periods(team_id) where active;
create index esea_coach_period_identity on public.esea_coach_roster_periods(coach_id,observed_at desc,id);
alter table public.esea_coach_roster_periods enable row level security;
revoke all on public.esea_coach_roster_periods from public,anon,authenticated;
grant select,insert,update on public.esea_coach_roster_periods to service_role;

insert into public.esea_coach_roster_periods
 (team_id,season,coach_id,nickname,country,source_started_at,period_started_at,start_source,
  first_seen_at,observed_at,ended_at,active,team_snapshot)
select r.team_id,r.season,r.coach_id,r.nickname,r.country,r.source_started_at,
 coalesce(r.source_started_at,r.first_seen_at),
 case when r.source_started_at is null then 'first_observed' else 'league_membership' end,
 r.first_seen_at,r.observed_at,case when r.active then null else greatest(r.observed_at,coalesce(r.source_started_at,r.first_seen_at)) end,
 r.active,t.team
from public.esea_coach_rosters r join public.team_catalog t on t.team_id=r.team_id;

-- Retain the existing identity, season, stale-write and permission validation.
alter function public.record_esea_coach_roster(text,integer,timestamptz,text,text,text,timestamptz)
 rename to record_esea_coach_roster_snapshot;
create function public.record_esea_coach_roster(
 p_team_id text,p_season integer,p_observed_at timestamptz,
 p_coach_id text,p_nickname text,p_country text,p_started_at timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
 v_current public.esea_coach_roster_periods%rowtype;
 v_team jsonb;
 v_start timestamptz;
 v_previous_end timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('coach-period:' || p_team_id,0));
 if not public.record_esea_coach_roster_snapshot(p_team_id,p_season,p_observed_at,
   p_coach_id,p_nickname,p_country,p_started_at) then return false; end if;
 select team into v_team from public.team_catalog where team_id=p_team_id;
 select * into v_current from public.esea_coach_roster_periods
   where team_id=p_team_id and active for update;
 if v_current.id is not null and v_current.coach_id=p_coach_id
   and v_current.source_started_at is not distinct from p_started_at then
   update public.esea_coach_roster_periods set season=p_season,nickname=p_nickname,
     country=coalesce(p_country,country),observed_at=p_observed_at,team_snapshot=v_team
     where id=v_current.id;
   return true;
 end if;
 update public.esea_coach_roster_periods set active=false,
   ended_at=greatest(observed_at,period_started_at) where team_id=p_team_id and active;
 if p_coach_id is not null then
   select max(ended_at) into v_previous_end from public.esea_coach_roster_periods
     where team_id=p_team_id and coach_id=p_coach_id;
   v_start=coalesce(p_started_at,p_observed_at);
   -- Membership start can stay unchanged when someone leaves/returns to the coach role.
   -- In that case the new stint starts at its first observation, not the old join date.
   if v_previous_end is not null and v_start <= v_previous_end then v_start=p_observed_at; end if;
   v_start=least(v_start,p_observed_at);
   insert into public.esea_coach_roster_periods
     (team_id,season,coach_id,nickname,country,source_started_at,period_started_at,start_source,
      first_seen_at,observed_at,active,team_snapshot)
   values(p_team_id,p_season,p_coach_id,p_nickname,p_country,p_started_at,v_start,
     case when v_start=p_started_at then 'league_membership' else 'first_observed' end,
     p_observed_at,p_observed_at,true,v_team);
 end if;
 return true;
end;
$$;
revoke all on function public.record_esea_coach_roster(text,integer,timestamptz,text,text,text,timestamptz)
 from public,anon,authenticated;
grant execute on function public.record_esea_coach_roster(text,integer,timestamptz,text,text,text,timestamptz)
 to service_role;
