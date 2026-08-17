-- Включаем Realtime (postgres_changes) для match_stat_jobs — scripts/statsWorker.js
-- подписывается на INSERT, чтобы забирать новые задачи сразу, а не только по
-- polling-таймеру. Fallback-поллинг (60с) остаётся отдельно — job, ставшая due
-- позже по next_attempt_at (retry-бэкофф), не сопровождается новым INSERT,
-- Realtime её не увидит.
--
-- service_role (statsWorker.js) обходит RLS как и везде в проекте — публикация
-- сама по себе не открывает доступ anon/authenticated, у них по-прежнему нет
-- прав на эту таблицу (revoke в 0003_match_stat_jobs.sql).

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_stat_jobs'
  ) then
    alter publication supabase_realtime add table public.match_stat_jobs;
  end if;
end $$;
