# Автоматизация матчей

## Что работает

- `sync-live.yml` каждые 5 минут обновляет только live и матчи рядом со временем старта.
- `sync-matches.yml` каждые 15 минут ищет новые матчи на 7 дней вперёд и завершённые за последние 7 дней.
- В Supabase записываются только новые или реально изменившиеся строки.
- Главная страница показывает upcoming только на ближайшие 24 часа и подписана на Supabase Realtime.

## Установка

1. Скопируйте файлы проекта в репозиторий.
2. Проверьте GitHub Secrets: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `FACEIT_API_KEY`.
3. В GitHub Actions вручную запустите сначала `Discover FACEIT matches`, затем `Refresh live FACEIT matches`.
4. В Supabase Dashboard откройте Database → Replication и включите Realtime для таблицы `matches`.

## Локальная проверка

```powershell
npm ci
node --env-file=.env.local scripts/autoSyncMatches.js
node --env-file=.env.local scripts/autoSyncMatches.js --live
npm run build
```

GitHub Actions поддерживает расписание не чаще одного раза в 5 минут. Для обновления счёта каждую минуту понадобится отдельный постоянно работающий сервер или внешний cron.
