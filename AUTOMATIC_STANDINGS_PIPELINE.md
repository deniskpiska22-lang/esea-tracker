# Automatic standings pipeline

The match synchronization no longer uses the manually maintained `src/data/teams.js`.
Operational scripts import `src/data/teams.generated.js`, which is generated from FACEIT standings.

## Configuration

Edit `scripts/v2/standings.config.json` and add every stage or conference that should be imported.
Set `active` to `true`. The FACEIT standings limit is fixed at 100; pagination is retained automatically.

## Commands

```bash
npm run v2:sync
```

Fetch standings and generate:

- `data/v2/standings-teams.json` — full normalized source data;
- `src/data/teams.generated.js` — runtime team list for match scripts.

To additionally load team profiles, rosters and player countries through Open FACEIT API:

```bash
npm run v2:sync:profiles
```

This requires `FACEIT_API_KEY` in `.env.local`.

Run the complete local match pipeline:

```bash
npm run sync:full
```

## GitHub Actions

`.github/workflows/sync-matches.yml` now refreshes standings before match discovery, so newly registered teams are included even before their first match.

## Migration status

The operational match scripts use `teams.generated.js`. The old `teams.js` is preserved only for the current frontend/ranking content and can be removed after the UI is migrated to generated/Supabase team data.
