-- worker_status — простой heartbeat для Live Worker / Stats Worker на Railway.
--
-- Задача: дать возможность одним select'ом увидеть, что оба постоянных
-- Railway-процесса (scripts/worker.js и scripts/statsWorker.js) живы, без
-- захода в Railway-логи. Каждый процесс апсертит свою строку по worker_name
-- на каждом цикле — "протухшая" (last_ping давно не обновлялся) строка
-- означает, что процесс завис или упал.

create table if not exists public.worker_status (
  worker_name text primary key,
  last_ping timestamptz not null default now(),
  status text not null default 'online',
  detail text,
  updated_at timestamptz not null default now()
);

alter table public.worker_status enable row level security;

revoke all on table public.worker_status from anon, authenticated;
