# Qualifier opponent strength (hltv-crosswalk-v1)

League match calculations and season seeds are unchanged. All qualifier titles
(including `Qual 3`, qualification and Finnish `karsinta`) share the same policy.
No tier/prize pool/title bonus, placement bonus or per-map bonus is awarded.

Our initial crosswalk places HLTV #110 at 700 internal points, based on the
owner's Fire Flux (#116 HLTV / 699 points) and LAG (#102 / 697 points) examples.
Strength = anchor + 160 × log2(110 / world rank). This is an editorial rating
policy, not a claim that HLTV/Valve points use our scale.

The anchor is the median of confirmed current league rosters at HLTV #80–150,
using each team's internal points immediately before the match. At least two
verified rosters and three prior results are required; otherwise use 700.
Clamp the reference anchor to 450–850 to limit unstable calibration. Never
replace a league participant's own score or reorder the leaderboard by HLTV.

A qualifier's K factor starts at 26 around our leaders' level and grows with
verified external strength above the anchor: 26 × 2^(excess / 400), capped at 60.
Use Elo expectation on the same 200-point scale and the existing series margin.
No provisional or geographic multiplier. Cap each series change at 60, allow
zero for overwhelmingly expected wins/losses. This growth avoids Elo saturation
awarding the same 25 points for beating both a league leader and HLTV #40.
At the 700-point reference, a 250-point team winning BO1 receives approximately
26 against #110, 31 against #70, 39 against #40 and 43 against #31.

Current league/historical league ratings take precedence. An external side
needs three distinct verified FACEIT accounts from the actual room's roster
matching a unique ranked core. Never identify a professional team by its name.
Coaches, substitutes and oversized/ambiguous rosters cannot establish a core.
HLTV player profiles' direct FACEIT UUID links establish identity. The small
reviewed `hltvPlayerLinks.json` supplies an explicitly documented owner-confirmed
link where a player has not published one. Nicknames only select profiles to
fetch; they cannot establish ranking evidence. Unknown external sides get a
neutral 275-point estimate with 50% confidence until five observed results.
This deliberately limits points changes when there is insufficient evidence.

Use the last weekly world ranking available before each match. Since HLTV does
not expose a publication time, activate Monday's list at Tuesday 00:00 UTC.
Never use a future list; expire evidence after 14 days. Valve ranking is unused.
Historical raw match rosters supply identity at that time, not today's roster.

`syncQualifierStrength.js` caches source snapshots and profile links, checks
the ranking date/top 30/unique IDs, and pauses HTTP requests on 403/429. Errors
preserve cached evidence; no anti-bot bypass. At most 240 successful source
requests per run, 20-second timeouts and 300ms spacing. Refresh every 12 hours
through automation, followed by the deterministic current-season replay.
The workflow bootstraps source history, compares the old/new derived ratings,
and publishes only on main after tests and a comparison with real HLTV matches.
Weekly rating snapshots and old season seeds are not rewritten.

The replay stores explanations in `qualifier_rating_audit` and external-only
preview estimates in `qualifier_opponent_ratings`. Public roles can only read
these; source caches and identity maintenance are service-only. Match forecasts
share the same formula, confirm roster overlap, and exclude outsiders from
league rank calculations. Missing evidence leaves a forecast unavailable.
