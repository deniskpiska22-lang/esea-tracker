// Persist progress after saving each page. A killed process may repeat a page,
// but must never advance past matches that have not reached the database.
export function retryAfterMs(value, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

export async function runDiscoveryScan({
  jobs, state = {}, fetchPage, saveRows, checkpoint, onError = () => {},
  now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  intervalMs = 1500, budgetMs = 180000, maxRequests = 160,
}) {
  const started = now();
  if (!jobs.length || Number(state.retryAt || 0) > started) {
    return { requests: 0, saved: 0, deferred: true, state };
  }
  let index = Math.max(0, jobs.findIndex((job) => job.id === state.nextId));
  let offset = jobs[index]?.id === state.nextId ? Number(state.offset || 0) : 0;
  let completed = 0;
  let requests = 0;
  let saved = 0;
  while (completed < jobs.length && requests < maxRequests && now() - started < budgetMs) {
    const job = jobs[index];
    let page;
    if (requests) await sleep(intervalMs);
    if (now() - started >= budgetMs) break;
    requests += 1;
    try {
      page = await fetchPage(job, offset);
    } catch (error) {
      if (error.status === 429) {
        const rateLimitCount = Math.min(4, Number(state.rateLimitCount || 0) + 1);
        state = { nextId: job.id, offset, rateLimitCount,
          retryAt: now() + Math.max(error.retryAfterMs || 0, Math.min(3600000, 900000 * 2 ** (rateLimitCount - 1))) };
        await checkpoint(state);
        onError(job, error);
        return { requests, saved, rateLimited: true, state };
      }
      // Credential errors affect every source; do not hide them as an empty scan.
      if (error.status === 401) throw error;
      onError(job, error);
      page = { rows: [], done: true };
    }
    const rows = page.rows || [];
    await saveRows(rows); // A storage failure must leave the cursor unchanged.
    saved += rows.length;
    if (page.done === false) {
      offset = page.nextOffset;
    } else {
      completed += 1;
      index = (index + 1) % jobs.length;
      offset = 0;
    }
    state = { nextId: jobs[index].id, offset, retryAt: 0, rateLimitCount: 0 };
    await checkpoint(state);
  }
  return { requests, saved, completed, state };
}
