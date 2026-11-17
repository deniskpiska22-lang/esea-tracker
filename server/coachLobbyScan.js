export async function scanCoachLobbies({
  state, due, fetchRoom, saveRoom, deferRoom, saveState, wait, validId, onError, now = Date.now,
}) {
  const eligibleAt = Math.max(Number(state.retryAt) || 0, Number(state.nextRunAt) || 0);
  if (eligibleAt > now()) return { deferred: true, retryAt: new Date(eligibleAt).toISOString() };
  const rows = (await due()).filter(row => validId(row.id)).slice(0, 192);
  const nextRunAt = now() + 3 * 60 * 60 * 1000;
  // Persist before source requests: crashes or redeploys must not trigger extra runs.
  await saveState({ retryAt: 0, nextRunAt }, 'running');
  const totals = { checked: 0, withCoaches: 0, failed: 0 };
  for (const [index, row] of rows.entries()) {
    if (index) await wait();
    let snapshot;
    try {
      snapshot = await fetchRoom(row);
    } catch (error) {
      totals.failed++;
      onError(row, error);
      // An access denial is not evidence about the individual match. Leave it in the queue.
      if (error.status === 403 || error.status === 429) {
        const retryAt = Math.max(nextRunAt, error.retryAt || 0);
        await saveState({ retryAt, nextRunAt, httpStatus: error.status }, 'backoff');
        return { ...totals, denied: true, retryAt: new Date(retryAt).toISOString() };
      }
      await deferRoom(row.id, now() + 12 * 3600000);
      continue;
    }
    await saveRoom(snapshot);
    totals.checked++;
    if (snapshot.coach_ids.length) totals.withCoaches++;
  }
  await saveState({ retryAt: 0, nextRunAt, ...totals }, totals.failed ? 'error' : 'online');
  return totals;
}
