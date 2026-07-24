-- claim_match_stat_jobs(): переподхват "зависших" processing-задач.
--
-- Проблема: claim_match_stat_jobs() выбирает только status='pending'. Если
-- processMatchStatJobs.js прерывается после захвата (status='processing'),
-- но до resolveJobs() — процесс убит, упал по таймауту, или (в проде)
-- .github/workflows/process-stat-jobs.yml использует
-- concurrency.cancel-in-progress: true, и следующий cron-тик отменяет ещё
-- выполняющийся предыдущий запуск — эти job навсегда остаются в
-- 'processing' и никогда больше не попадают под условие status='pending'.
-- Со временем очередь "протекает": часть матчей молча выпадает из
-- обработки без единого failed/done.
--
-- Решение: функция дополнительно переподхватывает processing-строки,
-- которые не обновлялись дольше STALE_PROCESSING_MINUTES — это безопасно,
-- т.к. FOR UPDATE SKIP LOCKED всё так же гарантирует, что реально ещё
-- выполняющийся (недавно тронутый) job не будет захвачен повторно.

create or replace function public.claim_match_stat_jobs(
  p_batch_size integer default 20
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
    order by created_at
    limit p_batch_size
    for update skip locked
  )
  returning *;
$$;
