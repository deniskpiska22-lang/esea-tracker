# ESEA coaching profiles

Active ESEA league rosters come from the public team-leagues v2
leagues/{leagueId}/users/{userId}/teams/active endpoint. The importer tries
up to three known team members, validates the premade team ID, league team ID
and ESEA league ID, and accepts members with game_role=coach whose membership
has not ended. team_role controls permissions and is independent of coaching.
FACEIT Data API supplies each coach's nickname and country.

scripts/syncCoachRosters.js defaults to a read-only batch. Use --team with a
FACEIT team ID for one team, --apply to store observations, or --full to scan
all currently tracked active-season teams. The scheduled workflow resumes
from worker_status. Empty coach slots clear a previous active roster link.
Failures retain the last evidence. HTTP 403/429 stops the batch and stores a
cooldown. Storage transactions reject older concurrent observations.

The owner's confirmed assignments in server/coachAssignments.js take priority
in team cards and profiles. LisssTzz remains the coach of Eclipse Enforcers
Young from November 7, regardless of his FACEIT substitute role.

Roster evidence creates profiles and team links. Profile match, map and round
statistics use explicit match-room observations or confirmed manual coaching
periods. Roster confirmation dates are shown separately from match history.

The lobby archive worker still checks explicit faction coaches in eligible
ESEA CS2 rooms. Finalized observations are retained. HTTP 403/429 persists a
cooldown across worker restarts. Authorized saved room JSON can be imported
with scripts/importCoachLobbies.js, using --apply after inspecting its dry run.
