import { useCallback, useEffect, useState } from 'react';
export { requireData } from './adminApi.js';

// Retain the last successful snapshot on refresh failures. Cancel stale
// requests, bound network waits, and pause polling while the tab is hidden.
export function useAdminResource(loader, { pollMs = 0 } = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ data: null, error: '', loading: true, refreshing: true, updatedAt: null, checkedAt: null });
  useEffect(() => {
    let active = true, settled = false, timer, request;
    const run = async () => {
      clearTimeout(timer);
      if (!active || document.hidden) return;
      request?.abort();
      const controller = new AbortController(); request = controller;
      const timeout = setTimeout(() => controller.abort(), 10_000);
      setState(previous => ({ ...previous, loading: previous.data === null, refreshing: true, checkedAt: Date.now() }));
      try {
        const data = await loader({ signal: controller.signal });
        settled = true;
        if (active && request === controller) setState({ data, error: '', loading: false, refreshing: false, updatedAt: Date.now(), checkedAt: Date.now() });
      } catch (error) {
        if (active && request === controller) setState(previous => ({ ...previous, error: error?.message || 'Request failed', loading: false, refreshing: false }));
      } finally {
        clearTimeout(timeout);
        if (active && request === controller && pollMs && !document.hidden) timer = setTimeout(run, pollMs);
      }
    };
    const visibility = () => { clearTimeout(timer); if (!document.hidden) { if (pollMs || !settled) run(); } else request?.abort(); };
    Promise.resolve().then(run);
    document.addEventListener('visibilitychange', visibility);
    return () => { active = false; clearTimeout(timer); request?.abort(); document.removeEventListener('visibilitychange', visibility); };
  }, [loader, revision, pollMs]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  return { ...state, refresh };
}
