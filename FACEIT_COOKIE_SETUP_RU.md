# Автоматический fallback статистики FACEIT

Скрипт сначала использует официальный endpoint `open.faceit.com/data/v4/matches/{id}/stats`.
Если он возвращает 404, скрипт обращается к `www.faceit.com/api/stats/v3/matches/{id}`.

## 1. Замена файла

Замени в репозитории:

```text
scripts/autoSyncMatches.js
```

файлом `autoSyncMatches.js` из этого архива.

## 2. GitHub Secret

Открой репозиторий:

```text
Settings → Secrets and variables → Actions → New repository secret
```

Создай секрет:

```text
FACEIT_SESSION_COOKIE
```

Значение — полная строка заголовка Cookie из авторизованного запроса к `faceit.com`, например несколько пар `name=value`, разделённых `; `.
Не добавляй слово `Cookie:`.

## 3. Передача секрета workflow

В шаге, который запускает `npm run sync:live`, добавь:

```yaml
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
  FACEIT_API_KEY: ${{ secrets.FACEIT_API_KEY }}
  FACEIT_SESSION_COOKIE: ${{ secrets.FACEIT_SESSION_COOKIE }}
```

## 4. Проверка

В логе успешный fallback выглядит так:

```text
Map stats synced 1-...: 2 map(s) via stats-v3
```

Официальный endpoint отображается как:

```text
Map stats synced 1-...: 2 map(s) via data-v4
```

## Важно

Cookie является секретом аккаунта. Не коммить его в репозиторий и не вставляй в обычные переменные workflow. При выходе из FACEIT или истечении сессии cookie придётся обновить в GitHub Secrets.
