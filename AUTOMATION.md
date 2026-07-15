# Автоматическое обновление матчей

Синхронизатор `scripts/autoSyncMatches.js` выполняет полный цикл:

1. Находит новые scheduled/ready/ongoing матчи отслеживаемых команд.
2. Добавляет их в `public.matches` через upsert по FACEIT match id.
3. Обновляет активные матчи через FACEIT Data API v4: статус, старт, счёт и победителя.
4. После статуса FINISHED матч автоматически появляется в «Последних результатах», потому что главная страница читает секции напрямую из Supabase.

## GitHub Actions

В репозитории добавлен `.github/workflows/sync-matches.yml`, запуск — каждые 5 минут и вручную через Actions.

Добавьте в GitHub → Settings → Secrets and variables → Actions:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `FACEIT_API_KEY`

Затем запустите workflow `Sync matches` вручную один раз для проверки.

## Supabase

Выполните обновлённый `supabase_setup.sql` в SQL Editor. Он сохраняет публичное чтение и добавляет индексы для ленты матчей.

## Локальная проверка

```bash
npm ci
node --env-file=.env.local scripts/autoSyncMatches.js
npm run build
```

`SUPABASE_SECRET_KEY` и `FACEIT_API_KEY` нельзя добавлять в переменные с префиксом `VITE_`.
