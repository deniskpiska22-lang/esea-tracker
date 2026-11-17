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

The full-room sweep is paused. automationWorker now runs
scripts/syncCoachSeasonBoundaries.js instead. Phase one checks the first and
last played match for each team/season from S57 onward; phase two walks
neighbouring matches to narrow arrivals and departures. Teams with empty
endpoints are searched backwards, since they may have had a coach mid-season.
Existing terminal snapshots are reused for both teams. New batches contain at
most 20 requests (COACH_BOUNDARY_BATCH_SIZE, maximum 40), two seconds apart;
the cursor and phase are persisted across restarts. A 403 pauses the source
until it is repaired; 429 honours the source cooldown. Neither is recorded as
an absent coach. Starting a different queue does not bypass access denial.

esea_coach_season_bounds stores the last coached match and the next known
match without that coach. The UI shows this interval, not a fabricated
contract termination date. Unknown interior games and observed returns are
explicitly retained as uncertainty. Two matching endpoints do not prove an
uninterrupted tenure, and unobserved matches are not added to win rates.
Manual owner assignments continue to take precedence. Authorized saved room
JSON can be imported with scripts/importCoachLobbies.js, using --apply after
inspecting its dry run.
