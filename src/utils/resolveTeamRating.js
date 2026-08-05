/**
 * Resolves which rating row in a candidate list belongs to a given team.
 *
 * Mirrors the server-side resolveTeam() in scripts/recalculateRatings.js:
 * match by id first, then by name only if the name is unique among the
 * candidates, then by slug/division to disambiguate ties. If a name matches
 * more than one row and slug/division can't narrow it to exactly one, give
 * up rather than guessing — a duplicate team name must never silently
 * resolve to an unrelated team's rating.
 */
export function resolveRatingRow(
  { ids = [], slug = null, name = null, division = null },
  rowIdentities,
) {
  const targetIds = new Set(
    ids.filter(Boolean).map((value) => String(value)),
  );

  if (targetIds.size > 0) {
    const idMatch = rowIdentities.find((entry) =>
      entry.ids.some((id) => targetIds.has(id)),
    );
    if (idMatch) {
      return idMatch.row;
    }
  }

  if (!name) {
    return null;
  }

  const nameMatches = rowIdentities.filter(
    (entry) => entry.name === name,
  );

  if (nameMatches.length === 0) {
    return null;
  }

  if (nameMatches.length === 1) {
    return nameMatches[0].row;
  }

  if (slug) {
    const bySlug = nameMatches.filter(
      (entry) => entry.slug === slug,
    );
    if (bySlug.length === 1) {
      return bySlug[0].row;
    }
  }

  if (division) {
    const byDivision = nameMatches.filter(
      (entry) => entry.division === division,
    );
    if (byDivision.length === 1) {
      return byDivision[0].row;
    }
  }

  return null;
}
