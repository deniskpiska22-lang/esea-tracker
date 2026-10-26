import { useSearchParams } from 'react-router-dom';
export function useAdminQuery() {
  const [params, setParams] = useSearchParams();
  const update = patch => setParams(previous => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value === null || value === 0) next.delete(key); else next.set(key, String(value));
    }
    return next;
  }, { replace: true });
  return [params, update];
}
export function pageIndex(value) { return /^\d{1,5}$/.test(value || '') ? Number(value) : 0; }
