export async function playerEloCandidates(db, { teamId, now = Date.now(), limit = 240 } = {}) {
  const cutoff = new Date(now - 86400000).toISOString();
  const ordered = query => query.order('faceit_profile_synced_at', { nullsFirst: true }).order('faceit_id');
  if (teamId) {
    const { data, error } = await ordered(db.from('players').select('faceit_id,team_players!inner(is_active,team_id)')
      .eq('team_players.is_active', true).eq('team_players.team_id', teamId)).limit(limit);
    if (error) throw error;
    return data || [];
  }
  // Both current and former players need ELO. Reserve part of each batch for
  // routine refresh so a large backfill cannot freeze already-known ratings.
  const missing = ['is.null', 'lte.0'].flatMap(elo => ['is.null', `lt.${cutoff}`]
    .map(synced => `and(faceit_elo.${elo},faceit_profile_synced_at.${synced})`)).join(',');
  const results = await Promise.all([
    ordered(db.from('players').select('faceit_id').not('faceit_id', 'is', null).or(missing)).limit(Math.floor(limit * .75)),
    ordered(db.from('players').select('faceit_id').not('faceit_id', 'is', null)
      .or(`faceit_profile_synced_at.is.null,faceit_profile_synced_at.lt.${cutoff}`)).limit(limit),
  ]);
  for (const result of results) if (result.error) throw result.error;
  return [...new Map(results.flatMap(result => result.data || []).map(row => [row.faceit_id, row])).values()].slice(0, limit);
}
