alter table public.tournaments add column if not exists lifecycle jsonb;
comment on column public.tournaments.lifecycle is 'FACEIT source state, full match-scan activity and freshness for safe tournament live status.';
