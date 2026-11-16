# ESEA coaching profiles

FACEIT's public room payload (match/v2/match) is the source. A coach comes
only from a faction's explicit coaches array, not its active league roster,
member list or substitutes. Both faction identities must match the saved
match. A roster member not shown as a coach in the room does not count.

The automation worker checks eligible ESEA CS2 rooms in batches, refreshes
recent upcoming rooms and stores finished observations. Historical batches
run every ten minutes independently of standings and match discovery.
They work back through the full tracked ESEA archive, reserving capacity
for upcoming rooms. The batch uses one request at a time. Room outages are retried
without discarding evidence. A 403 or 429 stops the batch and stores an upstream
cooldown of at least one hour, honoring a longer Retry-After. Railway restarts
keep the cooldown. Denied rooms stay in the queue; readiness is distinct from
access to the lobby source. Logs record selected response metadata only, without
cookies, tokens, or response bodies.

Team cards link directly to the coach profile. Profile career dates
are dates of confirmed room appearances, not employment dates. Team map
statistics count recent maps from rooms listing that coach, and round win
rates only use verified demo stats with explicit coverage.

If FACEIT provides an authorized export of completed CS2 match rooms, pass
one saved room JSON (or the original JSON response envelope) per file to:
`node scripts/importCoachLobbies.js room.json ...`. Supply the usual server
Supabase variables. Dry run is the default; add `--apply` to save. The import
validates the stored result, both team IDs and explicit coach roles. It skips
already finalized observations and does not query FACEIT or infer assignments.
