import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { createActivityTracker } from '../utils/visitorActivity.js';
import { pulsePresence } from '../lib/sitePresence.js';
import { PRESENCE_INTERVAL_MS, trafficPath } from '../utils/siteTraffic.js';

export default function SitePresence() {
  const { pathname, key } = useLocation();
  const pendingView = useRef(null);
  const activity = useRef(null);
  useEffect(() => {
    const tracker = createActivityTracker({ visible: !document.hidden });
    activity.current = tracker;
    const interact = event => tracker.interact(event);
    const visibility = () => tracker.visibility(!document.hidden);
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(name => window.addEventListener(name, interact, { passive: true }));
    document.addEventListener('visibilitychange', visibility);
    return () => {
      events.forEach(name => window.removeEventListener(name, interact));
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    if (!trafficPath(pathname)) return;
    const navigation = `${key}:${pathname}`;
    if (pendingView.current?.navigation !== navigation) pendingView.current = { navigation, event: { id: crypto.randomUUID(), referrer: document.referrer }, sent: false };
    const view = pendingView.current;
    let stopped = false;
    let timer;
    let interactionTimer;
    const refresh = async () => {
      clearTimeout(timer);
      if (stopped || document.hidden) return;
      try { if (await pulsePresence({ path: pathname, viewEvent: view.sent ? null : view.event, activity: { ...activity.current?.snapshot(), event: view.event } })) view.sent = true; } catch { /* Analytics cannot interrupt the site. */ }
      if (!stopped && !document.hidden) timer = setTimeout(refresh, PRESENCE_INTERVAL_MS);
    };
    const onVisibility = () => { clearTimeout(timer); if (!document.hidden) refresh(); };
    const onInteraction = event => {
      if (!event.isTrusted || document.hidden || interactionTimer) return;
      interactionTimer = setTimeout(() => { interactionTimer = null; refresh(); }, 5000);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(name => window.addEventListener(name, onInteraction, { passive: true }));
    // Let the app render before starting the first tiny request.
    timer = setTimeout(refresh, 1500);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stopped = true; clearTimeout(timer); clearTimeout(interactionTimer); events.forEach(name => window.removeEventListener(name, onInteraction)); document.removeEventListener('visibilitychange', onVisibility); };
  }, [pathname, key]);
  return null;
}
