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
