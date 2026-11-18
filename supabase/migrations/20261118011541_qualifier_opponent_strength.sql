-- Weekly source evidence and stable account links are maintained by workers.
create table public.hltv_ranking_snapshots (
 ranking_date date primary key, source_url text not null,
 teams jsonb not null check (jsonb_typeof(teams) = 'array'),
 checked_at timestamptz not null default now()
);
create table public.hltv_player_identities (
 hltv_id integer primary key, faceit_id text,
 source_url text not null, checked_at timestamptz not null default now()
);
-- A preview cache only. These rows never enter the league leaderboard.
create table public.qualifier_opponent_ratings (
 team_id text primary key, team_name text not null, points integer not null,
 matches_played integer not null default 0, strength jsonb not null,
 roster_ids jsonb not null, observed_at timestamptz not null,
 updated_at timestamptz not null default now()
);
create table public.qualifier_rating_audit (
 season integer not null, match_id text not null,
 policy_version text not null, detail jsonb not null,
 updated_at timestamptz not null default now(), primary key(season,match_id)
);
alter table public.hltv_ranking_snapshots enable row level security;
alter table public.hltv_player_identities enable row level security;
alter table public.qualifier_opponent_ratings enable row level security;
alter table public.qualifier_rating_audit enable row level security;
revoke all on public.hltv_ranking_snapshots, public.hltv_player_identities,
 public.qualifier_opponent_ratings, public.qualifier_rating_audit from public, anon, authenticated;
grant all on public.hltv_ranking_snapshots, public.hltv_player_identities,
 public.qualifier_opponent_ratings, public.qualifier_rating_audit to service_role;
grant select on public.qualifier_opponent_ratings,public.qualifier_rating_audit to anon,authenticated;
create policy "Public opponent strength previews" on public.qualifier_opponent_ratings for select to anon,authenticated using (true);
create policy "Public qualifier rating explanations" on public.qualifier_rating_audit for select to anon,authenticated using (true);
