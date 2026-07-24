-- matches.stats_unavailable — Этап 3 автоматизации backlog статистики.
--
-- Проблема: syncFinishedMapStats() в autoSyncMatches.js сканирует
-- matches.stats_synced=false заново на каждом запуске, без памяти о том,
-- что конкретный матч уже провалил max_attempts попыток в match_stat_jobs
-- (FACEIT стабильно отдаёт 404 на data/v4/matches/{id}/stats). Матч
-- никогда не получает stats_synced=true, поэтому он бесконечно попадает
-- в тот же LIMIT MAP_STATS_BATCH_SIZE батч и вытесняет более новые
-- матчи, у которых стата ещё может появиться.
--
-- Решение: отдельный флаг вместо перегрузки stats_synced. Выставляется
-- один раз в processMatchStatJobs.js, когда job уходит в status='failed'
-- (attempts >= max_attempts), и с этого момента исключает матч из
-- сканирования syncFinishedMapStats() — без изменения смысла stats_synced
-- (остаётся false, как и есть по факту: статы так и не получены).

alter table public.matches
  add column if not exists stats_unavailable boolean not null default false;

create index if not exists matches_finished_stats_unavailable_idx
  on public.matches (stats_unavailable)
  where status in ('FINISHED', 'MATCH_STATUS_FINISHED')
    and stats_synced = false;
