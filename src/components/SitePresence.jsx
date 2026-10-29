import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { pulsePresence } from '../lib/sitePresence.js';
import { PRESENCE_INTERVAL_MS, trafficPath } from '../utils/siteTraffic.js';

export default function SitePresence() {
  const { pathname, key } = useLocation();
  const pendingView = useRef(null);
  useEffect(() => {
    if (!trafficPath(pathname)) return;
    const navigation = `${key}:${pathname}`;
    if (pendingView.current?.navigation !== navigation) pendingView.current = { navigation, event: { id: crypto.randomUUID(), referrer: document.referrer }, sent: false };
    const view = pendingView.current;
    let stopped = false;
    let timer;
    const refresh = async () => {
      clearTimeout(timer);
      if (stopped || document.hidden) return;
      try { if (await pulsePresence({ path: pathname, viewEvent: view.sent ? null : view.event })) view.sent = true; } catch { /* Analytics cannot interrupt the site. */ }
      if (!stopped && !document.hidden) timer = setTimeout(refresh, PRESENCE_INTERVAL_MS);
    };
    const onVisibility = () => { clearTimeout(timer); if (!document.hidden) refresh(); };
    // Let the app render before starting the first tiny request.
    timer = setTimeout(refresh, 1500);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [pathname, key]);
  return null;
}
