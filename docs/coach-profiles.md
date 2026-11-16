# Coach profiles

The initial directory is editorial. FACEIT documents a distinct coach role, but
the current sync does not ingest it. Never infer a role or tenure from match
participation, lack of stats, a shared organization name, or team membership.

Add verified public periods to `src/data/coaches.json`. Use a stable unique
coach slug, a unique period ID within that profile, and list periods most recent
first. Record the source URL. Use `status: "current"` only for confirmed active
assignments, and change it to `"past"` once it ends. Set `from` / `to` to the
known ISO day or month, or show only the `season` when that's all the source
confirms. Supported roles: `coach`, `head_coach`, `assistant_coach`.

Set `teamId` to the exact FACEIT team UUID to link the period to an existing
team page and show the coach below the player roster. Without a verified UUID
the historical team name remains visible as text. Never link another roster
with a similar name. Coaches don't enter the player roster or game statistics.
