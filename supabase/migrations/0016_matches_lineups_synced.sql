-- matches.lineups_synced — фильтр "уже синхронизировано" для
-- syncFinishedLineups() (autoSyncMatches.js), по аналогии с
-- stats_synced/stats_unavailable (0006_matches_stats_unavailable.sql).
--
-- До этой миграции syncFinishedLineups() сканировала ВЕСЬ 30-дневный /
-- LINEUP_SYNC_BATCH_SIZE-матчевый бэклог заново на каждый прогон, без
-- какого-либо фильтра — каждый вызов --post-match-only мог порождать до
-- ~3000 запросов к Supabase (100 матчей × ~10 игроков × ~3 запроса),
-- независимо от того, сколько job'ов реально было заклеймлено. С переходом
-- statsWorker.js на событийный Realtime-триггер (0015) это могло срабатывать
-- почти на каждый новый stats_sync job — то есть многократно чаще, чем
-- раньше.

alter table public.matches
  add column if not exists lineups_synced boolean not null default false;

alter table public.matches
  add column if not exists lineups_synced_at timestamptz;

-- Backfill: все матчи, уже находящиеся в статусе FINISHED на момент
-- применения этой миграции, считаются исторически обработанными — они уже
-- прошли через много прогонов старой (нефильтрованной) syncFinishedLineups().
-- Без этого backfill'а первый же прогон после деплоя воспринял бы весь
-- бэклог как несинхронизированный и обработал бы его разом — ровно тот
-- аварийный всплеск запросов, который эта миграция должна предотвратить.
-- Матчи, завершающиеся ПОСЛЕ применения миграции, вставляются/обновляются
-- с lineups_synced по умолчанию false и будут обработаны обычным путём.
update public.matches
set lineups_synced = true,
    lineups_synced_at = now()
where status in ('FINISHED', 'MATCH_STATUS_FINISHED')
  and lineups_synced = false;

create index if not exists matches_finished_lineups_sync_idx
  on public.matches (lineups_synced, finished_at)
  where status in ('FINISHED', 'MATCH_STATUS_FINISHED');
