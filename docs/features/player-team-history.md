# Player team history

Player profiles expose Teams via `?tab=teams`. The existing nickname canonicalization
preserves this query, language basename, route state and hash. Player SEO stays unchanged.

Order: summary, chronological-team history table (latest first), career chart.
The chart retains the approved logo nodes, colored bands and selected-period card.
No mock preview entries, demo fixtures, new data tables or external requests are shipped.

The existing player match projection combines stored site archives with live public
Supabase history. The new pure helper deduplicates match IDs, excludes undated rows,
sorts chronologically and creates consecutive team-ID runs. A return to an earlier
team is another period; a display-name change for the same ID is not. Catalogue names,
logos and profile URLs are resolved by immutable identity, never an unrelated namesake.

First/last recorded appearances are observations, not transfer dates or continuous
membership. The latest recorded team is labelled accordingly. The summary shows teams,
recorded matches and the first recorded match, without invented membership durations.
Win rate uses decided recorded series. Rating/ADR averages use available positive values;
unknown metrics remain blank. Per-period disclosures link to up to five latest matches.

No auth, SQL permissions, player photos, rankings, GEO ads or demo ingestion changes.

Validation: eight helper/identity/URL tests; ESLint on touched JS/JSX; Vite production build;
local browser against real public player data, including period disclosures and links.
The isolated local QA HTML disables analytics by omitting the app shell entirely and is
not part of the release. Production browser verification follows Railway SUCCESS.
