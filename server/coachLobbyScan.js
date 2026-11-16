export async function scanCoachLobbies({
  state, due, fetchRoom, saveRoom, deferRoom, saveState, wait, validId, onError, now = Date.now,
}) {
  if (state.retryAt > now()) return { deferred: true, retryAt: new Date(state.retryAt).toISOString() };
  const rows = (await due()).filter(row => validId(row.id)).slice(0, 40);
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
        await saveState({ retryAt: error.retryAt, httpStatus: error.status }, 'backoff');
        return { ...totals, denied: true, retryAt: new Date(error.retryAt).toISOString() };
      }
      await deferRoom(row.id, now() + 12 * 3600000);
      continue;
    }
    await saveRoom(snapshot);
    totals.checked++;
    if (snapshot.coach_ids.length) totals.withCoaches++;
  }
  await saveState({ retryAt: 0, ...totals }, totals.failed ? 'error' : 'online');
  return totals;
}
