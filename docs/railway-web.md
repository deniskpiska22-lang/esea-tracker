# Railway web service

The production website and all 12 `/api/*` handlers run in the `esea-web`
service in the existing `esea-tracker` Railway project. Background worker
services remain separate. The web service follows this repository's `main`.

## Deployment

- Builder: `Dockerfile.web` (configured on the service).
- Start command: `node server/startWeb.js`; port `8080`; readiness `/healthz`.
- One Europe West replica, capped at 1 vCPU and 1 GB RAM.
- `npm run build:web` builds Vite/SEO and precompresses static assets.
- `npm start` starts the same HTTP service locally after a build.
- The root `railway.json` continues to configure workers. Set
  `RAILWAY_PROCESS_TYPE=web` as an additional safeguard on the web service.

Required public build/runtime variables are `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_HOSTING_PROVIDER=railway`.
Runtime-only secrets are `FACEIT_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_SECRET_KEY` (legacy API alias for the same server credential),
and `SUPABASE_URL`. Railway service references supply these without copying
secret values into source or Docker build arguments.

The optional existing team-submission integration needs `TELEGRAM_BOT_TOKEN`
and `TELEGRAM_CHAT_ID` at runtime. It returns 503 when they are missing;
do not test a real submission without authorization to send a message.

## Routing and cache

`server/webRouting.js` reads the existing `vercel.json` route contract.
Server-rendered SEO, canonical redirects, language prefixes, map filters and
dynamic sitemap pages run through the original API handlers. Static assets
are served only from `dist`, with MIME types, conditional requests and gzip.

Only successful anonymous GET responses with an explicit `s-maxage` opt in
to the bounded process cache (128 entries, 32 MB of uncompressed bodies,
maximum 8 MB per entry). The existing home match response fits this limit;
its compressed representation is also reused during its short public TTL.
Cookies, Authorization, private/no-store, Set-Cookie and Vary responses are
excluded. Restarting clears the cache; fresh requests reload the existing DB.
GEO ad policy, odds and individual forum topics retain no-store behavior.

## Match odds

Match rooms without fresh winner odds try `/api/onewin-markets?lang=en` for a
current binary CS2 question from 1win Markets. The existing GEO policy still
applies. Questions come from the public `polybet` feed (esports category 2037,
Counter-Strike tournament 46323); yes/no probabilities come from fresh public
snapshots, with a 60-second lifetime. The browser polls every
15 seconds while visible. Event lists are shared for 60 seconds per language,
and snapshots for 10 seconds. Closed, expired, suspended or unavailable
questions fall back to a Markets category link without probabilities. Question links
revalidate the event before redirecting to its Markets page with `p=g39d`.
This uses the existing public client settings and requires no new secrets.

`ONEWIN_PUBLIC_PARTNER_ID` and `ONEWIN_PUBLIC_SOURCE_ORIGIN` can supply the
public configuration advertised by 1win's sportsbook client. These are not
private account credentials. The API origin is fixed to the verified public
feed; source mirrors must match the existing HTTPS allowlist. Without these
variables, the source discovers settings from the supplied public landing URL.

The service shares a 30-second event-list cache and a 10-second per-event odds
cache across visitors. Active match pages poll every 8 seconds when odds are
available, retry every 30 seconds when unavailable, and pause in hidden tabs.
Prices expire after 20 seconds. Missing, suspended, stale or ambiguous markets
hide the block; visits revalidate the market before the affiliate redirect.
No separate paid worker or bookmaker account is required. Logs distinguish
landing-page, template and event-feed failures.

Vercel Analytics/Speed Insights are disabled for Railway builds. Existing
Yandex Metrika and Clarity remain in the frontend.

## Country policy

Railway's edge supplies `X-Real-IP`; the server resolves its country locally
using the pinned `geoip-country` IPv4/IPv6 database. Visitor-supplied country
headers are replaced. Russia receives PARI, known non-RU countries receive
1win, and unknown countries receive neither. Language never selects ads.

This product includes GeoLite2 data created by MaxMind, available at
https://www.maxmind.com/. Library/database licenses remain in the runtime
package. Keep the pinned database package current when maintaining deployments
and comply with its bundled LICENSE/EULA; no IP lookup service receives
visitor IP addresses.

## Domain cutover

The canonical origin stays `https://eseatracker.ru`; `www` redirects there.
This preserves production Auth redirects, browser sessions and SEO URLs.
The test address is `https://esea-web-production.up.railway.app`.

Both custom domains are attached to Railway. Obtain current required CNAME
and verification TXT values from Railway before changing DNS. Railway requires
CNAME flattening/ALIAS at the apex; REG.RU's standard DNS panel does not allow
an apex CNAME. Use a compatible DNS provider and preserve every existing mail,
verification and other unrelated record before changing nameservers. Never
copy a resolved Railway edge IP into an A record; Railway does not provide a
stable ingress IP for this setup. Do not remove the Vercel domain until the
new domain's ownership, HTTPS certificate and live site are verified.

Checks: `node --test tests/*.test.js`; production build; actual browser checks
for home/upcoming filters, match lineups, map history, team/player profiles,
forum and login. `/api/test-db` verifies public DB connectivity without
returning match contents or credentials.


## Private visitor statistics

`/admin?section=traffic` (also summarized on the admin overview) shows online browsers
with a heartbeat in the last 3 minutes, unique browsers today/yesterday and over
7 days, a daily chart, last active pages, countries and device types. Calendar days
use Europe/Moscow (UTC+3), displayed in the UI. Collection begins with this release;
there is no historical backfill from Clarity/Vercel.

`SitePresence` waits for the initial render, then sends a tiny same-origin JSON POST
to `/api/site-presence` every 20 seconds while visible. A shared localStorage UUID
and Web Lock coordinate tabs/windows. Without storage, collection is skipped instead
of issuing unstable per-tab identities. The server hashes IDs, filters known bot user
agents and coalesces writes within 15 seconds; the database primary key is (day, visitor).
No raw IP, user ID, query string, referrer or authentication URLs are stored. A browser
can have only one last active page. Distinct devices/private browsing can count twice;
this is an estimate of browsers, not a verified count of people.

The existing server Supabase secret is used; there are no new environment variables
or services. Tables live in the unexposed `site_analytics` schema with RLS and no
anon/authenticated table grants. Only service_role may call `record_site_presence`.
`admin_site_traffic` delegates to the existing private administrator guard and returns
only aggregate data. The UI refreshes every 15 seconds, pauses while hidden, labels
errors/stale snapshots, and is translated into all seven site languages.

Validation: `node --test tests/siteTraffic.test.js tests/adminWorkspace.test.js tests/webServer.test.js`.
Database checks also exercise five-tab deduplication, three-minute expiry, cross-midnight IDs,
service-role writes, anonymous denial and non-admin denial inside a rolled-back transaction.

### Match fallback promotion

The match-room fallback now keeps the native 1win design and advertises other CS2
matches with a link to bonus terms. It does not show Markets questions or poll
`onewin-markets`. Actual fresh match odds retain priority. Its CTA uses
`/api/onewin?kind=click&lang=…&placement=match_room_native`, redirecting to the
user-provided `https://1win.com/?open=register&p=g39d`. Referral parameters can be
verified in HTTP redirects; crediting registrations/deposits must be verified in
the partner dashboard and cannot be guaranteed from the URL alone.


Match fallback CTA now explicitly uses `destination=cs2`. The server resolves the
validated configured 1win mirror and redirects to `/betting/esport/cs2-142?p=g39d`.
It never sends this CTA to Markets or the registration landing. Other placements
retain their existing destination; no query parameter may override the referral code.


PARI native CTAs for Russian visitors use `/api/pari?placement=…` instead of
embedding the third-party affiliate tracking host in the page anchor. The endpoint
checks trusted RU GEO and redirects with the unchanged offer812/partner34440/landing88
and fixed campaign values. The visible CTA is localized as “Перейти в PARI”.


Match links preserve their internal source path (including filters) in router state.
All three match views share `MatchBackLink`: Home opens back to Home; team pages,
match lists and tournament pages return to their source. Explicit existing `from`
state is retained. Direct URLs/new tabs use the existing team-match fallback;
external or malformed return addresses are rejected. Router paths omit the locale
prefix because BrowserRouter supplies its language basename.


## Desktop density

Desktop viewports (1024 CSS px and wider at browser 100%) render the site at 80%
using root CSS zoom, applied inline before the boot shell. There is no setting or
switch. The Vite PostCSS pass also scales responsive width thresholds by 0.8 and
compensates viewport units by 1.25, so layouts behave like a browser zoomed out,
rather than retaining the old narrow layout. Narrow touch/mobile layouts retain
their existing dimensions. Browser zoom and accessibility controls remain available.
