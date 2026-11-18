# Tournament lifecycle

`scripts/config/trackedTournaments.json` is the reviewed championship registry.
The tournament worker registers missing entries and preserves existing routes and
tiers. A push changing the registry also runs the bounded GitHub import job; worker
refreshes continue independently of it. The automation worker checks tournaments
before long player/standings jobs. No browser credentials are exposed.

Official FACEIT championship metadata, matches and subscriptions are read with
bounded timeouts and complete pagination. Optional website roster failure does not
block import: match participants or previously saved teams provide the fallback.
Malformed or truncated match pages fail the import rather than certifying an empty
completed event. Registry titles keep archived metadata failures human-readable.

Verified terminal championship status or the complete declared single-group bracket
final closes an event. A gap between rounds or a partial bracket cannot certify
completion. The database preserves a verified completed_at when a concurrent importer
tries to replace it with null. Source status, round count, schedule and match activity
are stored in the lifecycle JSON alongside checkedAt.

A live badge requires recent match activity (36 hours), a near next match (24 hours),
or a recent active match (12 hours), plus a successful source scan within 12 hours.
An old stuck ongoing match cannot keep refreshing itself as live just because its
status was fetched again. Stale/idle incomplete events appear as Awaiting schedule,
not as finished; they remain visible in the calendar. Terminal status always wins,
even for a canceled future event. Date-only display follows the visitor time rule.

Worker refresh eligibility uses verified completion, never an estimated end date.
Current events are checked every 3 minutes when the worker runs; distant future or
old unresolved events use a daily source refresh. Confirmed events leave the scan
after 3 days. API failures preserve previous data; frontend freshness removes stale
live badges while the source is unavailable.

Validation: node --test tests/tournament*.test.js and npm run check:time.
