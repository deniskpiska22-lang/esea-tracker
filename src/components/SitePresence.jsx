import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pulsePresence } from '../lib/sitePresence.js';
import { PRESENCE_INTERVAL_MS, trafficPath } from '../utils/siteTraffic.js';

export default function SitePresence() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!trafficPath(pathname)) return;
    let stopped = false;
    let timer;
    const refresh = async () => {
      clearTimeout(timer);
      if (stopped || document.hidden) return;
      try { await pulsePresence({ path: pathname }); } catch { /* Analytics cannot interrupt the site. */ }
      if (!stopped && !document.hidden) timer = setTimeout(refresh, PRESENCE_INTERVAL_MS);
    };
    const onVisibility = () => { clearTimeout(timer); if (!document.hidden) refresh(); };
    // Let the app render before starting the first tiny request.
    timer = setTimeout(refresh, 1500);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [pathname]);
  return null;
}
