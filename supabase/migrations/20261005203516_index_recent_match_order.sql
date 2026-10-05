-- Postgres DESC defaults to NULLS FIRST. The homepage explicitly requests
-- NULLS LAST, so the old finished_at index could not satisfy its ordering.
set local lock_timeout = '3s';
set local statement_timeout = '90s';
create index if not exists matches_recent_finished_at_idx
  on public.matches(finished_at desc nulls last)
  where status in ('FINISHED','MATCH_STATUS_FINISHED');
