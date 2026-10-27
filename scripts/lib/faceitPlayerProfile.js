function positiveInteger(value, maximum = Infinity) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= maximum ? number : null;
}

export function faceitEloPatch(profile, expectedId, now = new Date().toISOString()) {
  if (!expectedId || profile?.player_id !== expectedId) throw new Error('FACEIT profile ID mismatch');
  const patch = { faceit_profile_synced_at: now };
  const elo = positiveInteger(profile.games?.cs2?.faceit_elo);
  const level = positiveInteger(profile.games?.cs2?.skill_level, 10);
  // Roster-only profiles and players without CS2 must not erase known ELO.
  if (elo !== null) patch.faceit_elo = elo;
  if (level !== null) patch.faceit_level = level;
  return patch;
}
