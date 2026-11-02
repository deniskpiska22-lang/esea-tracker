# Active visitor analytics

The admin traffic panel defaults to **Active visitors**. **All browser visits** retains the original unqualified history. These are browser estimates, not a claim to identify humans with certainty. No historical rows are reclassified.

Qualification requires at least 5 seconds of continuous visible-page time and a trusted pointer, wheel, touch or keyboard event within 180 seconds. Programmatic scroll events do not qualify. Background tabs do not pulse. Interaction prompts a pulse after 5 seconds; regular heartbeats remain 20 seconds. Online uses the existing 180-second window since the last qualifying heartbeat. It is possible to undercount passive readers or very short visits. Automation can imitate client signals; this is not an anti-fraud boundary.

A shared localStorage UUID and Web Lock deduplicate browser tabs. Existing exclusions for admin/auth paths remain. Known automation user agents are excluded; a bounded per-browser burst limit rejects more than 60 uncached writes per minute. No raw IP addresses, keyboard contents or cursor traces are stored.

`record_site_presence_v2` is service-role-only. It records legacy data, then optionally writes separately to private `site_active` tables. Anonymous and ordinary authenticated clients have no table or write-RPC access. `admin_site_traffic` keeps its existing administrator guard and returns the original payload plus an `active` payload. Both modes include all periods, countries, page history and details, with independent start dates.

The migration snapshots the current report query structure into `forum_private.active_site_traffic` and `active_traffic_details`. Future reporting changes should update both modes. Test fixtures must use rolled-back transactions and never appear as production traffic.
