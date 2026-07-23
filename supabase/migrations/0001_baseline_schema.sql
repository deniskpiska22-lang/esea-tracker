-- Baseline schema snapshot — ESEA Tracker
-- ---------------------------------------------------------------------------
-- ЧТО ЭТО: документирующая миграция реальной структуры Supabase по состоянию
-- на 2026-07-23. Схема получена read-only интроспекцией через PostgREST
-- OpenAPI (GET {SUPABASE_URL}/rest/v1/) — ни одна таблица/строка не была
-- изменена в процессе. Раньше 14 из 15 таблиц не были версионированы вообще
-- (supabase_setup.sql описывал только колонки matches, добавленные позже).
--
-- ИДЕМПОТЕНТНОСТЬ: каждый оператор — CREATE ... IF NOT EXISTS / ADD COLUMN
-- IF NOT EXISTS. Применение к базе, где эти таблицы уже существуют, — no-op.
-- Применение к пустой базе (например, для локального/staging окружения) —
-- создаёт схему с нуля.
--
-- НЕ ПРИМЕНЯТЬ К ПРОДУ АВТОМАТИЧЕСКИ. Это только файл миграции в git;
-- фактический `supabase db push`/выполнение в SQL Editor — отдельный шаг,
-- требующий явного подтверждения (см. AUDIT/PLAN в истории проекта).
--
-- ИЗВЕСТНЫЕ ПРОБЕЛЫ (PostgREST REST-интроспекция их принципиально не даёт,
-- нужен прямой доступ к Postgres/SQL Editor):
--   1. RLS-политики есть только для `matches` (перенесены из
--      supabase_setup.sql). Для остальных 14 таблиц политики НЕ отражены —
--      это не значит, что их нет, значит, что их нужно отдельно выгрузить
--      через `select * from pg_policies where schemaname='public'`.
--   2. Тела RPC-функций `rebuild_team_roster`, `review_team_claim`,
--      `sync_normalized_match_stats`, `submit_team_claim` существуют в базе
--      (подтверждено через PostgREST /rpc/* пути), но их SQL-код не
--      захвачен — REST API не выдаёт определения функций. Нужно выгрузить
--      вручную: `select pg_get_functiondef(oid) from pg_proc where proname
--      in (...)` в SQL Editor.
--   3. `profiles.id` по конвенции Supabase Auth почти наверняка ссылается на
--      `auth.users(id)`, но REST-интроспекция не подтверждает FK за пределы
--      exposed-схемы — внешний ключ здесь не объявляется, чтобы не
--      фабриковать непроверенное ограничение.
-- ---------------------------------------------------------------------------

-- =============================================================================
-- matches — уже частично описана в supabase_setup.sql; здесь полная форма.
-- =============================================================================
create table if not exists public.matches (
  id text primary key,
  championship_id text,
  competition_name text,
  status text not null default 'SCHEDULED',
  best_of integer,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  team1_id text,
  team1_name text,
  team1_slug text,
  team1_logo text,
  team1_score integer default 0,
  team2_id text,
  team2_name text,
  team2_slug text,
  team2_logo text,
  team2_score integer default 0,
  winner_id text,
  faceit_url text,
  raw_data jsonb,
  player_stats jsonb,
  maps jsonb not null default '[]'::jsonb,
  map_scores jsonb not null default '[]'::jsonb,
  stats_synced boolean not null default false,
  stats_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_status_scheduled_at_idx
  on public.matches (status, scheduled_at);
create index if not exists matches_finished_at_idx
  on public.matches (finished_at desc);
create index if not exists matches_finished_stats_sync_idx
  on public.matches (stats_synced, finished_at)
  where status in ('FINISHED', 'MATCH_STATUS_FINISHED');

alter table public.matches enable row level security;

revoke insert, update, delete on table public.matches from anon, authenticated;
grant select on table public.matches to anon, authenticated;

drop policy if exists "Public can read matches" on public.matches;
create policy "Public can read matches"
  on public.matches for select to anon, authenticated using (true);

-- =============================================================================
-- players
-- =============================================================================
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  faceit_id text not null,
  nickname text not null,
  avatar text,
  country text,
  steam_id text,
  faceit_elo integer default 0,
  faceit_level integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- onConflict: "faceit_id" используется во всех апсертах (autoSyncMatches.js,
-- syncTeamRosters.js, backfillTeamPlayerAppearances.js) — уникальность нужна.
create unique index if not exists players_faceit_id_key
  on public.players (faceit_id);

-- =============================================================================
-- team_players
-- =============================================================================
create table if not exists public.team_players (
  id uuid primary key default gen_random_uuid(),
  team_id text not null,
  player_id uuid not null references public.players(id),
  joined_at timestamptz default now(),
  left_at timestamptz,
  is_active boolean default true,
  official_photo_url text,
  official_photo_verified boolean not null default false,
  official_photo_verified_at timestamptz,
  official_photo_verified_by uuid
);

-- onConflict: "team_id,player_id" в syncTeamRosters.js.
create unique index if not exists team_players_team_player_key
  on public.team_players (team_id, player_id);
create index if not exists team_players_player_id_idx
  on public.team_players (player_id);

-- =============================================================================
-- team_ratings
-- =============================================================================
create table if not exists public.team_ratings (
  team_id text primary key,
  team_name text not null,
  slug text,
  division text,
  points integer not null default 0,
  previous_points integer not null default 0,
  points_change integer not null default 0,
  matches_played integer not null default 0,
  ranking_status text not null default 'unranked',
  previous_rank integer,
  rank_change integer not null default 0,
  weekly_points_change integer not null default 0,
  weekly_rank_change integer not null default 0,
  rating_snapshot_at timestamptz,
  updated_at timestamptz default now()
);

-- =============================================================================
-- player_ratings
-- =============================================================================
create table if not exists public.player_ratings (
  player_id text primary key,
  nickname text,
  rating numeric not null default 0,
  recent_rating numeric,
  matches_played integer not null default 0,
  maps_played integer not null default 0,
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  adr numeric not null default 0,
  kd numeric not null default 0,
  last_match_at timestamptz,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- team_rating_history
-- =============================================================================
create table if not exists public.team_rating_history (
  id bigint generated always as identity primary key,
  team_id text not null,
  points integer not null,
  world_rank integer,
  matches_played integer not null default 0,
  snapshot_type text not null default 'recalculation',
  week_start date not null,
  created_at timestamptz not null default now()
);

-- onConflict: "team_id,week_start" в snapshotWeeklyRatingHistory.js.
create unique index if not exists team_rating_history_team_week_key
  on public.team_rating_history (team_id, week_start);

-- =============================================================================
-- team_player_appearances
-- =============================================================================
create table if not exists public.team_player_appearances (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.matches(id),
  team_id text not null,
  player_id uuid not null references public.players(id),
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists team_player_appearances_match_id_idx
  on public.team_player_appearances (match_id);
create index if not exists team_player_appearances_player_id_idx
  on public.team_player_appearances (player_id);

-- =============================================================================
-- profiles
-- (id референсит auth.users(id) по конвенции Supabase — не объявляем FK,
--  см. пробел №3 в шапке файла)
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key,
  username text not null,
  display_name text,
  avatar_url text,
  bio text,
  country_code text,
  birth_date date,
  favorite_team_slug text,
  account_type text default 'fan',
  team_id text,
  team_role text,
  team_slug text,
  verification_status text default 'none',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- match_comments
-- =============================================================================
create table if not exists public.match_comments (
  id bigint generated always as identity primary key,
  match_id text not null,
  user_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_comments_match_id_idx
  on public.match_comments (match_id);

-- =============================================================================
-- match_votes
-- =============================================================================
create table if not exists public.match_votes (
  id bigint generated always as identity primary key,
  match_id text not null,
  user_id uuid not null,
  team_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists match_votes_match_id_idx
  on public.match_votes (match_id);

-- =============================================================================
-- team_lineups
-- =============================================================================
create table if not exists public.team_lineups (
  id bigint generated always as identity primary key,
  team_id text not null,
  player_id uuid not null references public.players(id),
  slot smallint not null,
  appearances integer not null default 0,
  matches_analyzed integer not null default 0,
  recent_score numeric not null default 0,
  average_rating numeric,
  last_match_at timestamptz,
  confidence text not null default 'provisional',
  source text not null default 'match_history',
  updated_at timestamptz not null default now()
);

-- updateStartingLineups.js делает delete-by-team_id + insert (не upsert),
-- поэтому composite unique constraint кодом не подразумевается — только
-- индекс для выборки по команде.
create index if not exists team_lineups_team_id_idx
  on public.team_lineups (team_id);

-- =============================================================================
-- team_lineup_sync_state
-- =============================================================================
create table if not exists public.team_lineup_sync_state (
  team_id text primary key,
  last_source_match_id text,
  last_source_match_at timestamptz,
  matches_analyzed integer not null default 0,
  lineup_size smallint not null default 0,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- team_claim_requests
-- =============================================================================
create table if not exists public.team_claim_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  team_slug text not null,
  account_type text not null,
  team_role text not null,
  request_type text not null default 'join_team',
  proof_url text,
  contact_email text,
  contact_handle text,
  message text,
  birth_date date,
  status text not null default 'pending',
  rejection_reason text,
  previous_team_slug text,
  previous_account_type text,
  previous_team_role text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

create index if not exists team_claim_requests_user_id_idx
  on public.team_claim_requests (user_id);
create index if not exists team_claim_requests_status_idx
  on public.team_claim_requests (status);

-- =============================================================================
-- match_maps
-- =============================================================================
create table if not exists public.match_maps (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches(id),
  map_index integer not null,
  map_name text not null,
  team1_score integer,
  team2_score integer,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_maps_match_id_idx
  on public.match_maps (match_id);

-- =============================================================================
-- match_player_stats
-- =============================================================================
create table if not exists public.match_player_stats (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches(id),
  team_id text,
  team_name text,
  faceit_player_id text,
  nickname text not null,
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  adr numeric not null default 0,
  kd numeric not null default 0,
  hs_rate numeric not null default 0,
  kast numeric not null default 0,
  mvps integer not null default 0,
  rating numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_player_stats_match_id_idx
  on public.match_player_stats (match_id);
create index if not exists match_player_stats_faceit_player_id_idx
  on public.match_player_stats (faceit_player_id);

-- =============================================================================
-- RPC-функции, существующие в базе (сигнатуры подтверждены через
-- PostgREST /rpc/* пути), но НЕ воспроизведённые здесь — см. пробел №2.
--   - rebuild_team_roster
--   - review_team_claim
--   - sync_normalized_match_stats
--   - submit_team_claim
-- Эта миграция намеренно их не создаёт/не заменяет, чтобы не перезаписать
-- существующую боевую реализацию неполной догадкой.
-- =============================================================================
