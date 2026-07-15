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

## Автоматическая статистика карт

Файл `src/data/maps.js` больше не нужно редактировать вручную. Перед каждой production-сборкой выполняется:

```powershell
npm run generate:maps
```

Скрипт читает `src/data/matchStatsCompact.json`, сопоставляет команды по `faceitTeamId`, считает число сыгранных карт и процент побед, затем полностью пересоздаёт `src/data/maps.js`.

Для ручной проверки:

```powershell
npm run generate:maps
npm run build
```

## Полностью автоматический сбор карт

После однократного выполнения обновлённого `supabase_setup.sql` ручные команды для карт не нужны.

Workflow `sync-matches.yml` каждые 15 минут:
1. находит upcoming и недавно завершённые матчи;
2. обновляет статус и счёт в таблице `matches`;
3. для каждого завершённого матча с `stats_synced = false` вызывает официальный FACEIT endpoint `/data/v4/matches/{match_id}/stats`;
4. сохраняет `maps` и `map_scores` в ту же строку матча;
5. страницы команды и статистики получают прошедшие матчи и агрегированную статистику карт через `/api/team-stats`.

Workflow `sync-live.yml` также проверяет завершившиеся матчи каждые 5 минут, поэтому карты обычно появляются вскоре после окончания игры.
