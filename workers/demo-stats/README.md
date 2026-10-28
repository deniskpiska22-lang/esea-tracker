# Verified demo round statistics

Independent Railway service, root `/workers/demo-stats`, its own Dockerfile. Does not share
the live/stats worker event loop. One download/parser at a time, 30-second
poll, one CPU / 2 GB service limit. Requires the round-statistics migration.

Server-only environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional
`FACEIT_API_KEY` for metadata, and a scoped `FACEIT_DOWNLOADS_TOKEN` for files.
Logical resource URLs are exchanged with Downloads API before downloading.
Without the Downloads token automatic downloads stay paused; administrator
uploads are still processed. Automatic analysis jobs are not claimed.
The existing site's Data API key was tried on the live Downloads endpoint and
returned HTTP 500; that is not a successful authorization check or a download.
401/403 is recorded as `access_required`.
An authorization failure pauses all signing requests for six hours; updating
the token redeploys the worker and resumes immediately, without hammering
the provider once per queued match.
Three consecutive Downloads 5xx responses trigger a 15-minute circuit breaker.
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

## Administrator upload fallback

`/admin?section=demos` accepts a tracked finished match URL/ID and one `.dem`,
`.dem.gz` or `.dem.zst` file per map (up to 256 MB). The authenticated administrator
prepares a server-generated object path, uploads directly to the private
`match-demo-inbox` Supabase bucket, then commits the verified byte size.
Guests and regular users cannot prepare/commit uploads or read the queue/files.
The existing demo worker claims the separate upload queue before checking
Downloads credentials. It verifies the historical Steam rosters, map and exact
score using the same native parser. Files are streamed/decompressed with the
same limits as FACEIT downloads and removed after processing. Only validated
aggregate counters are public. Conflicting statistics cannot replace an
already verified map. Expired leases are recoverable, temporary download errors
get at most three attempts, and abandoned uploads are cleaned after 24 hours.

The public admin preview uses labelled synthetic rows and cannot upload files.
An actual authenticated admin upload still requires a real admin session and
a demo for a tracked match; SQL fixtures are not a substitute for that test.
