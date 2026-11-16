# ESEA coaching profiles

FACEIT's public room payload (match/v2/match) is the source. A coach comes
only from a faction's explicit coaches array, not its active league roster,
member list or substitutes. Both faction identities must match the saved
match. A roster member not shown as a coach in the room does not count.

The automation worker checks eligible ESEA CS2 rooms in batches, refreshes
recent upcoming rooms and stores finished observations. The initial scan
covers the last 120 days; saved observations remain after that window.
Room outages are retried without discarding previously verified data.

Team staff is labelled with the linked source match. Profile career dates
are dates of confirmed room appearances, not employment dates. Team map
statistics count recent maps from rooms listing that coach, and round win
rates only use verified demo stats with explicit coverage.
