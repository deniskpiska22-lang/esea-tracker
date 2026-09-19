-- Keep current match statistics and ratings ahead of the legacy backlog.
-- Old jobs still remain recoverable, but can no longer block newly finished
-- matches whose official FACEIT stats are available now.

create or replace function public.claim_match_stat_jobs(
  p_batch_size integer default 50
)
returns setof public.match_stat_jobs
language sql
as $$
  update public.match_stat_jobs as claimed
  set status = 'processing',
      updated_at = now()
  where claimed.id in (
    select j.id
    from public.match_stat_jobs as j
    left join public.matches as m
      on m.id = j.match_id
    where (
      (j.status = 'pending' and j.next_attempt_at <= now())
      or (
        j.status = 'processing'
        and j.updated_at < now() - interval '15 minutes'
      )
    )
    order by
      case when j.job_type = 'stats_sync' then 0 else 1 end,
      coalesce(m.finished_at, m.scheduled_at) desc nulls last,
      j.created_at desc
    limit greatest(p_batch_size, 1)
    for update of j skip locked
  )
  returning claimed.*;
$$;

revoke all on function public.claim_match_stat_jobs(integer)
  from anon, authenticated;
