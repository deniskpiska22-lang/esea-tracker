-- matches.veto_steps / veto_synced / veto_unavailable — aggregate map
-- pick/ban history per team, without a live FACEIT call per page view.
--
-- Source is the same unofficial democracy/v1/match/{id}/history endpoint
-- already proxied by api/veto.js and parsed per-match by parseVetoSteps()
-- in src/components/MatchMapResults.jsx. veto_steps stores that response
-- normalized to faction-relative form ({ map, action, selectedBy, round },
-- selectedBy: "faction1"|"faction2"|null) rather than resolved to a team,
-- so the same row serves both teams in the match; perspective is resolved
-- at read time (see useTeamStats.js), the same way scores already are via
-- teamIsFirstInMatch.
--
-- veto_synced/veto_unavailable mirror the stats_synced/stats_unavailable
-- pair (0006_matches_stats_unavailable.sql): veto_unavailable is set once
-- a match is confirmed to have no veto history (BO1s set without a vote,
-- forfeits, etc.), so backfillMatchVeto.js doesn't retry it forever.

alter table public.matches
  add column if not exists veto_steps jsonb not null default '[]'::jsonb;

alter table public.matches
  add column if not exists veto_synced boolean not null default false;

alter table public.matches
  add column if not exists veto_synced_at timestamptz;

alter table public.matches
  add column if not exists veto_unavailable boolean not null default false;

create index if not exists matches_finished_veto_sync_idx
  on public.matches (veto_synced, finished_at)
  where status in ('FINISHED', 'MATCH_STATUS_FINISHED');
