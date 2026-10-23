alter table public.matches add column if not exists demo_round_stats jsonb not null default '[]'::jsonb;

create table public.match_demo_analysis_jobs (
  match_id text primary key references public.matches(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','retry','done','unavailable','access_required')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error text,
  updated_at timestamptz not null default now()
);
create index match_demo_analysis_due_idx on public.match_demo_analysis_jobs(next_attempt_at)
  where status in ('pending','retry','access_required','processing');
alter table public.match_demo_analysis_jobs enable row level security;
revoke all on public.match_demo_analysis_jobs from public, anon, authenticated;
grant all on public.match_demo_analysis_jobs to service_role;

create function public.claim_match_demo_analysis()
returns setof public.match_demo_analysis_jobs language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.match_demo_analysis_jobs(match_id)
    select m.id from public.matches m where m.status in ('FINISHED','MATCH_STATUS_FINISHED')
      and m.finished_at >= now() - interval '30 days' and m.finished_at < now() - interval '5 minutes'
      and case when jsonb_typeof(m.map_scores)='array' then jsonb_array_length(m.map_scores)>0 else false end
      and not exists(select 1 from public.match_demo_analysis_jobs j where j.match_id=m.id)
    order by m.finished_at desc limit 100 on conflict do nothing;
  return query update public.match_demo_analysis_jobs j
    set status='processing', attempts=j.attempts+1, lease_until=now()+interval '30 minutes',
      lease_token=gen_random_uuid(), updated_at=now()
    where j.match_id=(select candidate.match_id from public.match_demo_analysis_jobs candidate
      where ((candidate.status in ('pending','retry','access_required') and candidate.next_attempt_at<=now())
        or (candidate.status='processing' and candidate.lease_until<now()))
      order by candidate.next_attempt_at, candidate.match_id limit 1 for update skip locked)
    returning j.*;
end;
$$;
revoke all on function public.claim_match_demo_analysis() from public, anon, authenticated;
grant execute on function public.claim_match_demo_analysis() to service_role;

create function public.finish_match_demo_analysis(p_match_id text, p_lease_token uuid, p_results jsonb,
  p_status text, p_error text, p_next_attempt_at timestamptz)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.match_demo_analysis_jobs where match_id=p_match_id
    and status='processing' and lease_token=p_lease_token and lease_until>now() for update;
  if not found then return false; end if;
  if jsonb_array_length(p_results)>0 then
    -- Keep previously verified maps if a later retry has fewer available files.
    update public.matches set demo_round_stats=(select jsonb_agg(value) from (
      select distinct on(value->>'map') value from (
        select value, 0 as priority from jsonb_array_elements(p_results)
        union all select value, 1 from jsonb_array_elements(demo_round_stats)
      ) candidates order by value->>'map', priority
    ) merged) where id=p_match_id;
  end if;
  update public.match_demo_analysis_jobs set status=p_status,last_error=p_error,next_attempt_at=p_next_attempt_at,
    lease_until=null,lease_token=null,updated_at=now() where match_id=p_match_id;
  return true;
end;
$$;
revoke all on function public.finish_match_demo_analysis(text,uuid,jsonb,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.finish_match_demo_analysis(text,uuid,jsonb,text,text,timestamptz) to service_role;
