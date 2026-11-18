import { requestCoachData } from '../lib/coachRequest.js';
import { useEffect, useState } from 'react';

export default function useCoachData(key, value, attempt = 0) {
  const url = value ? `/api/coach?${new URLSearchParams({ [key]: value, v: 'confirmed-tenures-2' })}` : null;
  const [response, setResponse] = useState(null);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),25000);
    let stopped = false;
    requestCoachData(url, {signal:controller.signal}).then(result => {
      if (!stopped) setResponse({ url, attempt, ...result });
    }).catch(() => {
      if (!stopped) setResponse({ url, attempt, status: 503 });
    }).finally(() => clearTimeout(timeout));
    return () => { stopped = true; clearTimeout(timeout); controller.abort(); };
  }, [url,attempt]);
  return response?.url === url && response.attempt === attempt ? response : null;
}
