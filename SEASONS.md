# Season registration and rating transition

`scripts/v2/standings.config.json` selects S59 and exactly Entry, Intermediate,
Main and Advanced across all regions present in the supplied tree. The seeded
tree has 10 regular-season stages and 28 match championships (16 regular, 12
playoff). Open divisions are excluded. Championship IDs are read from conference
fields, never synthesized from division IDs.

Railway's existing `automationWorker.js` runs `syncStandings.js` every six hours.
The importer loads every regular-season stage with pagination, including zero-game
teams; if standings are not published it checks season registrations. Empty,
malformed, incomplete or conflicting imports do not alter the active roster or
the last good bundled team list. A same-season roster drop over 20% is rejected
for manual review, not automatically accepted.
S59's Asia, Oceania and South America stages were reviewed on October 2: both
stage/conference standings and registrations returned empty lists. Their IDs are
explicitly allowlisted in `verifiedEmptyStages`; each run must still successfully
check registrations before allowing an empty stage. Any teams later appearing
there are included normally. Errors and empty unreviewed stages still block sync.

Once a complete roster is available, the importer recalculates the old period,
then calls the service-role-only `sync_season_participants` RPC. In one transaction
it archives the old standings, records season participation, inserts new teams,
freezes rating seeds, and switches the active season. Existing team IDs, URLs,
points, match history and player pages are preserved; no team is deleted.

`current_team_ratings` exposes only registered current participants. Rankings,
Home, match ranks and weekly snapshots use that view. Rankings shows one continuous
current ranking without a season selector. Old team pages remain accessible; new team pages load their
metadata from `team_catalog` without waiting for a Vercel rebuild.

The rating replay starts from immutable season seeds. Earlier-season matches
cannot count twice. External tournament results continue to count after the
transition time. Before activation, future-season league matches are excluded
from the old-period replay. `publish_season_ratings` checks the active season and
shares a transaction lock with activation to reject stale cross-season writes.

All new tables have RLS and public SELECT-only grants. Activation and rating writes
are backend-only SECURITY INVOKER functions, with no public EXECUTE grants.

Checks: `node --test scripts/tests/seasonParticipants.test.js`, `npm run build`.
The database transition was tested inside a rolled-back transaction: archive,
point carryover, immutable seeds, idempotency, roster filtering and empty-import
rejection. No production season was switched by the test.

For the next season, update season/seasonId/cache in the config, seed its supplied
tree, verify all regions and division filters, and deploy. Never manually delete
non-participating teams from `team_ratings`.
