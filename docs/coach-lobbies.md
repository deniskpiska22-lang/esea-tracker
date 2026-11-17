# ESEA coaching profiles

Active ESEA league rosters come from the public team-leagues v2
leagues/{leagueId}/users/{userId}/teams/active endpoint. The importer tries
known team members, validates the premade team ID, league team ID
and ESEA league ID, and accepts members with game_role=coach whose membership
has not ended. team_role controls permissions and is independent of coaching.
FACEIT Data API supplies each coach's nickname and country.

scripts/syncCoachRosters.js defaults to a read-only batch. Use --team with a
FACEIT team ID for one team, --apply to store observations, or --full to scan
all currently tracked active-season teams. Use --missing to retry teams without a saved roster observation. The scheduled workflow resumes
from worker_status. Empty coach slots clear a previous active roster link.
Failures retain the last evidence. HTTP 403/429 stops the batch and stores a
cooldown. Storage transactions reject older concurrent observations.

The owner's confirmed assignments in server/coachAssignments.js take priority
in team cards and profiles. LisssTzz remains the coach of Eclipse Enforcers
Young from November 7, regardless of his FACEIT substitute role.

Roster evidence creates profiles and team links. Profile match, map and round
statistics use explicit match-room observations or confirmed manual coaching
periods. Roster confirmation dates are shown separately from match history.

The full-room sweep is restored and scheduled once every three hours by
scripts/automationWorker.js. scripts/syncCoachLobbies.js persists nextRunAt
before making source requests, so restarts do not trigger extra attempts.
Each bounded batch checks up to 192 due rooms, two seconds apart. Saved
terminal rooms are reused; the queue retains all unprocessed matches.
HTTP 403/429 stops the batch at the first denial. The next attempt is no
sooner than the three-hour interval or the source Retry-After, whichever is
later. A longer delay requested by FACEIT always takes precedence.

The season-boundary scanner is paused and no longer scheduled. Its saved
bounds remain available in profiles as intervals between confirmed match
rooms; these do not establish a contract termination date. Manual owner
assignments retain priority. Authorized saved room JSON can be imported
with scripts/importCoachLobbies.js, using --apply after inspecting its dry run.

Coaching stints are stored separately in esea_coach_roster_periods. The
record_esea_coach_roster transaction preserves completed stints, appends a new
one on a return, and updates the same stint during continuous membership or
a season rollover. An unchanged league membership date after a confirmed
absence is not reused as the return date: the first new observation is shown
instead. A departed stint stops at its last positive observation; this is not
an exact contractual termination date. Team snapshots survive catalog removal.

Profiles use all saved stints, including zero-match current stints. Career and
per-team results retain previous teams. Match-room-only A/B/A observations
are displayed as three periods instead of drawing an uninterrupted A span.
Manual owner assignments retain priority. GitHub normally refreshes current
rosters; the Railway automation cycle also runs a resumable roster batch when
the shared coach-rosters heartbeat is more than four hours old. Lobby source
failure does not prevent that separate roster refresh.

Automatic roster-based result attribution yields to a saved room explicitly
naming another coach for that team. That match is not credited to the current
coach merely because their membership join date is older. Empty/missing coach
slots are not proof of a departure, and explicit manual assignments retain
priority. All relevant saved team rooms are paginated for this check.

Dedicated service: coach-worker (RAILWAY_PROCESS_TYPE=coaches). Coach jobs no
longer run in automationWorker. The coach worker has independent job states,
heartbeats, timeouts and shutdown handling. A denied match-room source does
not stop roster refresh or stored-role imports. External roster/room jobs
retain their three-hour cadence and persistent source cooldowns.

The existing team-leagues match feed already includes factions[].members[]
with GAME_ROLE_COACH. esea_coach_match_rosters preserves that small payload
before later Data API writes replace raw_data; ordinary discovery also saves
it when score/status did not change. The dedicated worker consumes up to
1,000 stored rooms per minute without another FACEIT match-room request.
Only explicit coach roles are accepted; premade team and match IDs must match.
Missing role data is not an empty coach slot. Existing terminal room evidence
is never overwritten. Names use saved identities, with the official keyed
Data API only for otherwise unknown coach IDs. Each source has its own
cooldown, so blocked room requests do not prevent cache-backed progress.

Railway service settings: builder RAILPACK; build command
`node --check scripts/coachWorker.js`; start command
`node scripts/railwayEntrypoint.js`; one replica, no public domain.
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and FACEIT_API_KEY are service variable
references to automation-worker; no secret values are copied into the repo.
