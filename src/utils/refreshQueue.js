// Realtime can emit hundreds of changes during a sync. Keep one request in
// flight and coalesce the rest into a trailing refresh without starving it.
export function createRefreshQueue(refresh, intervalMs = 2000) {
  let disposed = false;
  let running = false;
  let dirty = false;
  let timer = null;
  let nextAt = 0;

  async function run() {
    timer = null;
    if (disposed || running) return;
    dirty = false;
    running = true;
    nextAt = Date.now() + intervalMs;
    try {
      await refresh();
    } catch (error) {
      console.warn('Realtime refresh failed:', error.message);
    } finally {
      running = false;
      if (dirty && !disposed) request();
    }
  }

  function request() {
    if (disposed) return;
    dirty = true;
    if (running || timer !== null) return;
    const delay = Math.max(0, nextAt - Date.now());
    if (delay === 0) void run();
    else timer = setTimeout(run, delay);
  }

  function dispose() {
    disposed = true;
    clearTimeout(timer);
  }

  return { request, dispose };
}
