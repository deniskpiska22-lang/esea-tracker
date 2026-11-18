import { useEffect, useState } from 'react';

export default function useCoachData(key, value) {
  const url = value ? `/api/coach?${new URLSearchParams({ [key]: value, v: 'confirmed-tenures-2' })}` : null;
  const [response, setResponse] = useState(null);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async res => ({
      status: res.status, data: res.ok ? await res.json() : null,
    })).then(result => {
      if (!controller.signal.aborted) setResponse({ url, ...result });
    }).catch(() => {
      if (!controller.signal.aborted) setResponse({ url, status: 503 });
    });
    return () => controller.abort();
  }, [url]);
  return response?.url === url ? response : null;
}
