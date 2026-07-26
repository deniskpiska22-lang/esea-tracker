-- tournaments — live mirror of src/data/tournaments.generated.json.
--
-- The generated JSON file stays as the bundled seed/fallback (works with no
-- Supabase configured, and is what ships in the build). This table is the
-- thing that can be refreshed on a schedule without a redeploy: scripts/
-- importTournament.js and scripts/refreshTournaments.js upsert into it via
-- the service role key, and TournamentPage.jsx reads it at runtime (falling
-- back to the bundled JSON entry when no row exists yet), the same way
-- LiveMatchPage.jsx already prefers a live `matches` row over static data.
--
-- `id` is our own slug (matches the JSON entry's `id`, e.g.
-- "esea-finals-s57") — that's what the frontend looks up by. `championship_id`
-- is the FACEIT id and is what the import scripts use to find "is this
-- tournament already tracked" regardless of what slug it was given.
create table if not exists public.tournaments (
  id text primary key,
  championship_id text unique,
  name text not null,
  logo text,
  tier text,
  location text,
  start_date date,
  end_date date,
  url text,
  prize_pool text,
  description text,
  formats jsonb,
  teams jsonb not null default '[]'::jsonb,
  bracket jsonb,
  groups jsonb,
  prize_distribution jsonb,
  map_pool jsonb,
  related_events jsonb,
  matches jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tournaments_championship_id_idx
  on public.tournaments (championship_id);

alter table public.tournaments enable row level security;

revoke insert, update, delete on table public.tournaments from anon, authenticated;
grant select on table public.tournaments to anon, authenticated;

drop policy if exists "Public can read tournaments" on public.tournaments;
create policy "Public can read tournaments"
  on public.tournaments for select to anon, authenticated using (true);
