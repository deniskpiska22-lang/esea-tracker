# ESEA Tracker 2.0 — first experiment

The first diagnostic importer uses the official FACEIT Data API and starts with S58 EU Advanced Central.

## Run

```bash
npm run v2:discover
```

Choose another configured championship:

```bash
npm run v2:discover -- --championship="S58 EU Main A"
```

Fast test without loading every player:

```bash
npm run v2:discover -- --max-matches=20 --max-teams=5 --players=false
```

The report is saved to:

```text
data/v2/discovery/<championship-id>.json
```

It contains championship metadata, matches, discovered teams, rosters, player countries, and a diagnostic summary. Production data and the existing `teams.js` are not modified.
