# Настройка авторизации

## 1. Переменные окружения

Создай `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Можно использовать `VITE_SUPABASE_ANON_KEY` вместо publishable key.

## 2. URL Configuration в Supabase

- Site URL: production URL сайта
- Redirect URLs:
  - `http://localhost:5173/**`
  - `https://YOUR_DOMAIN/**`

## 3. Edge Function для входа по логину

В проект добавлена функция:

`supabase/functions/login-with-username/index.ts`

Установи Supabase CLI, войди и свяжи проект:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy login-with-username --no-verify-jwt
```

Функция использует стандартные секреты Supabase:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Без деплоя Edge Function вход по email уже работает, а вход по username покажет сообщение, что сервер входа не настроен.

## 4. Проверка

```bash
npm install
npm run build
npm run dev
```

Открой `/register`, создай аккаунт и подтверди email. После этого войди на `/login`.
