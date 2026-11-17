# ESEA coaching profiles

## Shared match feed

The ordinary team-leagues match collector already receives
factions[].members[] with explicit GAME_ROLE_COACH roles. It stores these
small payloads in esea_coach_match_rosters, including discovery passes where
scores/status have not changed. A database trigger also preserves roles
before a later Data API update replaces matches.raw_data.

The dedicated coach-worker (RAILWAY_PROCESS_TYPE=coaches) consumes up to
1,000 stored rooms per minute. It validates match IDs, immutable premade team
IDs and explicit roles. Missing role data is not an empty coach slot. Saved
identities provide names; the official keyed player API is used only when
an identity is unknown. Existing terminal evidence remains protected.

Direct /api/match/v2/match/{id} polling is retired: it is neither a scheduled
job nor a fallback. The two old CLI entrypoints are harmless retirement
notices. Saved room JSON can still be imported with importCoachLobbies.js
(--apply after inspecting its dry run). Existing history and season-boundary
evidence are retained.

## Current ESEA rosters

Current membership/role updates remain separate. They use the public
team-leagues v2 leagues/{leagueId}/users/{userId}/teams/active endpoint.
The importer validates league, league-team and premade-team identities and
accepts game_role=coach; team_role permissions do not establish coaching.
It tries other known members when an old member has no active team.

syncCoachRosters.js supports --team, --apply, --full and --missing. Batches
resume from the shared coach-rosters checkpoint. The dedicated worker checks
rosters every three hours, avoiding a redundant run after a recent GitHub
refresh. HTTP 403/429 preserves evidence and source cooldowns. A roster
failure does not stop imports from the shared match feed.

## Coaching history and statistics

record_esea_coach_roster transactionally maintains separate stints in
esea_coach_roster_periods. Continuous refresh or season rollover updates the
same stint; a departure closes it, and a return creates a new one. An old
membership date is not reused to backdate a return after a confirmed gap.
Unknown starts use the first new confirmation. Departure bounds use the
last positive observation and are not exact contractual termination dates.
Team snapshots preserve history after catalog removal.

Profiles retain career and per-team results across transfers. A new current
stint appears on the timeline even before its first match. A/B/A match-room
observations produce separate spans, not one uninterrupted A tenure. Played
match counts agree between history and statistics; technical awards are not
added to win rates. Automatic roster attribution yields to a saved room
explicitly naming another coach for the same team.

The owner's confirmed assignments in server/coachAssignments.js retain
priority. LisssTzz remains the coach of Eclipse Enforcers Young from November
7 regardless of his FACEIT substitute role or an empty coach slot.

## Deployment

Coach jobs run only in the dedicated coach-worker, with independent job
states, persistent scheduling, heartbeats, timeouts and shutdown handling.
Removed job states are pruned on restart. automationWorker does not schedule
coach collection.

Railway settings: builder RAILPACK; build command
node --check scripts/coachWorker.js; start command
node scripts/railwayEntrypoint.js; one replica and no public domain.
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and FACEIT_API_KEY are private service
variable references to automation-worker. No secrets are stored in the repo.
