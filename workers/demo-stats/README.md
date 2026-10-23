# Verified demo round statistics

Independent Railway service, root `/workers/demo-stats`, its own Dockerfile. Does not share
the live/stats worker event loop. One download/parser at a time, 30-second
poll, one CPU / 2 GB service limit. Requires the round-statistics migration.

Server-only environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional
`FACEIT_API_KEY`. Logical resource URLs are exchanged with Downloads API
before downloading. Set a scoped `FACEIT_DOWNLOADS_TOKEN` when the existing
key has no Downloads permission; 401/403 is recorded as `access_required`.
An authorization failure pauses all signing requests for six hours; updating
the token redeploys the worker and resumes immediately, without hammering
the provider once per queued match.
Do not put any of these secrets in `VITE_*` variables.

The atomic service-role-only queue discovers finished matches from the last
30 days. It has recoverable leases, bounded retries, and a distinct
`access_required` status for 401/403 downloads. No permanent demo archive is
kept: compressed files stream to a size-limited decompressor, temporary files
are removed after analysis, and only verified aggregate counters are saved.
Limits: 256 MB compressed / 1 GB unpacked / 120-second download / 90-second
isolated native parse / at most five demo resources per match.

The parser uses historical Steam rosters, including substitutes, and requires
at least three matching players per side with no conflicting side votes.
Every counted round must belong to a contiguous scoreboard timeline ending
at the exact map result recorded by FACEIT. Restarts/restore duplicates are
resolved backwards from that result; incomplete demos, surrender awards,
technical scores and ambiguous rosters are rejected. Regulation halftime is
observed (MR12 or historical MR15). Pistols are its two opening rounds only.
CT/T rates include overtime; overtime has an additional separate counter.
Regulation halves include a shortened final half; draws count in the sample.

`matches.demo_round_stats` is public match data. Queue state/error details are
private. Existing map-history filters select both match results and demo
counters, and the UI always shows processed-map coverage. A missing demo is
an unavailable value, never an invented zero-percent win rate.

Tests: `node --test tests/demoRoundStats.test.js tests/teamMapStats.test.js`.
The native parser is a server dependency in this subdirectory only; it is not
bundled in the React client or Vercel functions.
