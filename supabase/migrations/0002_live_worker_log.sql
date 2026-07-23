-- live_worker_log — heartbeat/наблюдаемость для scripts/worker.js (Этап 3).
-- Полностью аддитивно и изолированно: ничего не читает/не пишет ни в matches,
-- ни в остальную схему. Безопасно откатывается: DROP TABLE без побочных
-- эффектов, если решите не продолжать с live-worker.
--
-- Не обязательна для работы worker.js — при отсутствии таблицы воркер
-- просто пропускает запись heartbeat (best-effort, см. logHeartbeat()).

create table if not exists public.live_worker_log (
  id bigint generated always as identity primary key,
  tick_at timestamptz not null default now(),
  matches_polled integer not null default 0,
  matches_updated integer not null default 0,
  error text
);

create index if not exists live_worker_log_tick_at_idx
  on public.live_worker_log (tick_at desc);

-- Публичного чтения не даём — это внутренняя диагностика, не фронтенд-данные.
alter table public.live_worker_log enable row level security;

revoke all on table public.live_worker_log from anon, authenticated;

-- service_role (используется worker.js и другими скриптами синка) обходит
-- RLS по умолчанию, отдельная политика ему не нужна.
