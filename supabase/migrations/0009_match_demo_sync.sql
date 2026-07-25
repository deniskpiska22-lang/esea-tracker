-- matches.demo_urls / demo_synced / demo_unavailable — быстрая доставка
-- демок (.dem.zst) завершённых матчей.
--
-- Источник demo_urls — внутренний FACEIT-эндпоинт team-leagues/v2/matches
-- (тот же, что уже используется buildDiscoveryUrl() в autoSyncMatches.js
-- для дискавери матчей), не официальный data/v4 API — поэтому это не
-- побочный продукт уже идущих stats/status запросов, а отдельный источник,
-- опрашиваемый через новый job_type="demo_sync" в существующей очереди
-- match_stat_jobs (см. 0003_match_stat_jobs.sql).
--
-- demo_synced/demo_unavailable зеркалят пару stats_synced/stats_unavailable
-- (0006_matches_stats_unavailable.sql): demo_unavailable выставляется после
-- исчерпания max_attempts (форфиты и т.п. — демки никогда не появится),
-- чтобы backfillMatchStatJobs.js не переставлял такой матч в очередь вечно.

alter table public.matches
  add column if not exists demo_urls jsonb not null default '[]'::jsonb;

alter table public.matches
  add column if not exists demo_synced boolean not null default false;

alter table public.matches
  add column if not exists demo_synced_at timestamptz;

alter table public.matches
  add column if not exists demo_unavailable boolean not null default false;

create index if not exists matches_finished_demo_sync_idx
  on public.matches (demo_synced, finished_at)
  where status in ('FINISHED', 'MATCH_STATUS_FINISHED');
