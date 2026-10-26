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
