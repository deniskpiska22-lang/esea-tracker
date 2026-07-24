-- match_stat_jobs — очередь post-match задач (Этап 5).
--
-- Producer: worker.js и autoSyncMatches.js (refreshActive) при обнаружении
-- перехода матча в FINISHED — оба независимо, для отказоустойчивости
-- (unique(match_id, job_type) гарантирует отсутствие дублей, даже если оба
-- процесса увидят переход одновременно).
--
-- Consumer: scripts/processMatchStatJobs.js — читает существующие
-- matches.stats_synced после прогона autoSyncMatches.js --post-match-only,
-- НЕ содержит собственной логики получения/сохранения статистики.
--
-- Старый пайплайн (полный autoSyncMatches.js по расписанию) не отключается
-- и продолжает быть страховкой независимо от состояния этой таблицы.

create table if not exists public.match_stat_jobs (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches(id),
  job_type text not null default 'stats_sync',
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists match_stat_jobs_match_job_key
  on public.match_stat_jobs (match_id, job_type);

create index if not exists match_stat_jobs_pending_idx
  on public.match_stat_jobs (status, next_attempt_at)
  where status in ('pending', 'processing');

-- Внутренняя операционная таблица — без публичного доступа, как и
-- live_worker_log. service_role (worker.js/autoSyncMatches.js/consumer)
-- обходит RLS по умолчанию.
alter table public.match_stat_jobs enable row level security;

revoke all on table public.match_stat_jobs from anon, authenticated;

-- Атомарный захват задач для scripts/processMatchStatJobs.js. PostgREST не
-- даёт выполнить сырой multi-statement SQL, поэтому "select due rows, then
-- update them" из клиента — это гонка при двух параллельных запусках.
-- Один SQL-оператор с FOR UPDATE SKIP LOCKED в подзапросе атомарен сам по
-- себе (в рамках одной транзакции Postgres) — два одновременных вызова
-- этой функции всегда получают непересекающиеся наборы задач.
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
    where status = 'pending'
      and next_attempt_at <= now()
    order by created_at
    limit p_batch_size
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_match_stat_jobs(integer)
  from anon, authenticated;
