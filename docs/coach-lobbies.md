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

Profiles count **all played team matches within a coaching tenure**, not just
matches attended by the coach. `buildCoachTenures` derives those tenures from
saved positive room/roster evidence and all chronological team matches. Room-only
coaches therefore receive the intervening team results too. A temporary substitute
coach or an empty coach slot does not immediately exclude a game or end a tenure.

Five consecutive played team matches with complete saved terminal coach-slot data
and no matching coach identity close the tenure exclusively at the start of that
streak. At one to four absences those games still count; the fifth removes all five
from the old tenure. A new positive confirmation resets the counter or opens a
separate return stint after closure. A positive new-team confirmation closes the
old team period immediately. Linked identities count as the same person.

Missing/partial rooms and failed requests are unknown, not absent: an unknown played
game breaks consecutiveness without ending the tenure. Upcoming/canceled games and
technical awards do not advance or reset the played-game counter. Roster-role spans
remain source observations; a temporary roster-role change alone does not close the
statistical tenure. Inactive archived teams have no current badge; an unresolved
archived span ends visually at its last known team match and can resume later.

Career, per-team and map win rates, timeline periods and team coach badges use the
same derived tenures. No new FACEIT requests or scheduled jobs are added: the policy
uses existing saved match and room data. Source backfill updates unknown observations
and deterministically recalculates the affected histories.

The owner's confirmed Eclipse Enforcers Young tenure starts November 7.
Until an explicit coach slot is saved from a match room, its handoffOnCoachLobby
assignment attributes team games from that date despite a substitute role or
an empty slot. Subscription purchase or current-roster membership alone cannot
release it. Historical Season 58 confirmation remains unchanged.

esea_coach_assignment_handoffs stores one private checkpoint per opted-in
manual tenure. A service-only trigger on normalized esea_coach_lobbies requires
the actual coaches array, a recognized linked identity, matching premade team,
ESEA match, valid status and a match date on/after the manual start. A pending
room must be fresh. This uses the existing shared match feed, without new
FACEIT requests. The checkpoint survives later empty slots, errors, overwrites
and deletion of the source match. The seed mirrors the opted-in JS assignment.

After that checkpoint, manual attribution ends exclusively at the handoff
boundary. Roster/room automation takes over; the original start and prior wins
are retained. A continuous first stint stays one timeline span even if the
roster is confirmed before its first played game. Transfers and returns keep
separate periods; newer coach-room evidence beats stale roster observations.
The team badge uses the same released priority as the coach profile. It never
reverts to the original manual override. The five-absence rule applies after handoff; the pending manual owner
assignment remains protected until its first coach-slot confirmation. Missing
room data cannot establish five consecutive absences.

Validation: node --test tests/coach*.test.js; tests/coachHandoff.sql checks the
actual database trigger and permissions inside a rolled-back transaction.

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
