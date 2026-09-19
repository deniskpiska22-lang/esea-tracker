# Полная автоматизация Railway

В проект добавлен отдельный постоянный сервис `automation-worker`. Он:

- обновляет список команд и стадии ESEA каждые 6 часов;
- ищет новые матчи всех настроенных регионов и дивизионов каждые 15 минут;
- каждые 15 минут ставит в очередь завершённые матчи без статистики;
- создаёт недельный снимок рейтинга по понедельникам UTC.

Существующие сервисы остаются включёнными:

- `worker.js` — статусы и счёт текущих матчей;
- `statsWorker.js` — карты, игроки, составы и пересчёт рейтинга;
- `tournamentWorker.js` — турниры.

## 1. Supabase

Один раз выполните в SQL Editor файл:

`supabase/migrations/0017_extend_stats_job_retries.sql`

Миграция возвращает старые failed-задачи статистики в очередь, увеличивает
лимит попыток с 5 до 12 и ставит `stats_sync` выше отключённых demo-задач.

## 2. Новый сервис Railway

Создайте ещё один сервис из того же GitHub-репозитория. В Settings укажите
Config file path:

`railway.automation-worker.json`

Обязательные Variables:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
FACEIT_API_KEY=...
```

В логах после запуска должны появиться:

```text
[automation-worker] standings-sync completed
[automation-worker] match-discovery completed
[automation-worker] stats-backfill completed
```

## 3. Stats Worker

Пока старый backlog обрабатывается, задайте сервису stats-worker:

```text
STAT_JOBS_BATCH_SIZE=50
MAP_STATS_BATCH_SIZE=50
MATCH_SYNC_CONCURRENCY=3
DEMO_SYNC_ENABLED=false
```

Рейтинг продолжит пересчитываться внутри существующего post-match pipeline
после появления новой статистики. Automation-worker сам рейтинг не считает,
чтобы два тяжёлых процесса не запускались одновременно.

## 4. GitHub Actions

Сначала оставьте Actions включёнными как страховку. Когда новый сервис
успешно отработает хотя бы два 15-минутных цикла, отключите расписание у
`sync-matches.yml` и `sync-live.yml`, но оставьте `workflow_dispatch` для
ручного запуска.

Серверные ключи нельзя добавлять в переменные `VITE_*` или коммитить в Git.
