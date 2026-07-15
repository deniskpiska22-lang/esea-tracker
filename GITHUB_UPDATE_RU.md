# Обновление существующего Refresh live FACEIT matches

Этот вариант не создаёт третий workflow. Файл `.github/workflows/sync-live.yml` каждые 5 минут запускает `npm run sync:live`.

За один запуск происходит следующее:

1. Обновляются запланированные и идущие матчи.
2. Матч, который закончился, получает статус `FINISHED`.
3. В этом же запуске выбираются завершённые матчи с `stats_synced = false`.
4. Запрашивается FACEIT `/data/v4/matches/{match_id}/stats`.
5. В `matches.maps` и `matches.map_scores` сохраняются карты, счёт и победитель карты.
6. `stats_synced` становится `true`.
7. API статистики команды считает map stats из этих записей Supabase.

Если статистика FACEIT ещё не готова, `stats_synced` остаётся `false`, поэтому следующая плановая попытка повторится автоматически.

## Что загрузить в GitHub

Замени в репозитории как минимум:

- `scripts/autoSyncMatches.js`
- `.github/workflows/sync-live.yml`
- `api/team-stats.js`
- `src/hooks/useTeamStats.js`
- `supabase_setup.sql`

Проще загрузить весь проект из архива.

## Secrets

В `Settings → Secrets and variables → Actions` должны быть:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (поддерживается также старое имя `SUPABASE_SECRET_KEY`)
- `FACEIT_API_KEY`

## Supabase

Один раз выполни `supabase_setup.sql` через `Supabase → SQL Editor → New query → Run`.
