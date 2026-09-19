-- Repair the existing stats backlog and make future jobs more resilient.

alter table public.match_stat_jobs
  alter column max_attempts set default 12;

-- Old jobs exhausted the previous five-attempt limit very quickly. Give
-- those stats jobs one clean retry window after this migration is applied.
update public.matches as m
set stats_unavailable = false
where m.stats_synced = false
  and exists (
    select 1
    from public.match_stat_jobs as j
    where j.match_id = m.id
      and j.job_type = 'stats_sync'
      and j.status = 'failed'
      and j.max_attempts < 12
  );

update public.match_stat_jobs
set status = 'pending',
    attempts = 0,
    max_attempts = 12,
    next_attempt_at = now(),
    last_error = null,
    completed_at = null,
    updated_at = now()
where job_type = 'stats_sync'
  and status = 'failed'
  and max_attempts < 12;

update public.match_stat_jobs
set max_attempts = 12,
    updated_at = now()
where job_type = 'stats_sync'
  and max_attempts < 12;

-- Keep stale-job recovery from migration 0007, increase the default batch,
-- and prevent the paused demo backlog from starving match statistics.
create or replace function public.claim_match_stat_jobs(
  p_batch_size integer default 50
)
returns setof public.match_stat_jobs
language sql
as $$
  update public.match_stat_jobs
  set status = 'processing',
      updated_at = now()
  where id in (
    select id
    from public.match_stat_jobs
    where (
      (status = 'pending' and next_attempt_at <= now())
      or (status = 'processing' and updated_at < now() - interval '15 minutes')
    )
    order by
      case when job_type = 'stats_sync' then 0 else 1 end,
      created_at
    limit greatest(p_batch_size, 1)
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_match_stat_jobs(integer)
  from anon, authenticated;
