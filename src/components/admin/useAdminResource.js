import { useCallback, useEffect, useState } from 'react';
export function useAdminResource(loader) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ data: null, error: '', loading: true });
  useEffect(() => {
    let active = true;
    Promise.resolve().then(loader).then(data => {
      if (active) setState({ data, error: '', loading: false });
    }).catch(error => {
      if (active) setState({ data: null, error: error.message || 'Request failed', loading: false });
    });
    return () => { active = false; };
  }, [loader, revision]);
  const refresh = useCallback(() => {
    setState(current => ({ ...current, loading: true, error: '' }));
    setRevision(value => value + 1);
  }, []);
  return { ...state, refresh };
}
export function requireData(response) {
  if (response.error) throw response.error;
  return response.data;
}
