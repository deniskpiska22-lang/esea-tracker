import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { selectAdLanguage } from '../lib/adLanguage.js';

let policyRequest;
function loadPolicy() {
  policyRequest ||= fetch('/api/ad-policy', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(5000) })
    .then(r => r.ok ? r.json() : null).catch(() => null);
  return policyRequest;
}
const labels = { ru: 'Реклама', en: 'Advertisement', de: 'Werbung', pt: 'Publicidade', es: 'Publicidad', fr: 'Publicité', it: 'Pubblicità' };
const observed = new Set();
function analytics(kind, data) {
  const event = `onewin_banner_${kind}`;
  try { if (typeof window.ym === 'function') window.ym(Number(window.__YANDEX_METRIKA_ID__ || 112877211), 'reachGoal', event, data); } catch { /* Analytics must never interrupt navigation. */ }
  window.dataLayer ||= [];
  window.dataLayer.push({ event, ...data });
}

function Banner({ placement, creativeLanguage, siteLanguage, country, page, className }) {
  const imageRef = useRef(null);
  const label = labels[siteLanguage] || labels.en;
  const data = { placement, creative: `1win_${creativeLanguage}`, language: creativeLanguage, site_language: siteLanguage, country, page };
  const key = [page, placement, creativeLanguage].join('|');
  useEffect(() => {
    const img = imageRef.current;
    if (!img || !window.IntersectionObserver || observed.has(key)) return undefined;
    let visible = false, timer, loaded = img.complete && img.naturalWidth > 0;
    const cancel = () => { clearTimeout(timer); timer = undefined; };
    const schedule = () => {
      cancel();
      if (!loaded || !visible || document.hidden || observed.has(key)) return;
      timer = setTimeout(() => {
        if (!visible || document.hidden || !img.isConnected || observed.has(key)) return;
        observed.add(key);
        analytics('view', { placement, creative: `1win_${creativeLanguage}`, language: creativeLanguage, site_language: siteLanguage, country, page });
        observer.disconnect();
      }, 1000);
    };
    const onLoad = () => { loaded = img.naturalWidth > 0; schedule(); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.intersectionRatio >= .5; schedule(); }, { threshold: [0, .5, 1] });
    observer.observe(img);
    img.addEventListener('load', onLoad);
    document.addEventListener('visibilitychange', schedule);
    return () => { cancel(); observer.disconnect(); img.removeEventListener('load', onLoad); document.removeEventListener('visibilitychange', schedule); };
  }, [key, placement, creativeLanguage, siteLanguage, country, page]);
  return <aside className={className} aria-label={`${label} 1win · 18+`}>
    <div className="px-2 py-1.5 text-center text-xs text-slate-400">{label} · 18+</div>
    <a href={`/api/onewin?kind=click&lang=${creativeLanguage}&placement=${placement}`} target="_blank" rel="sponsored noopener noreferrer nofollow" onClick={() => analytics('click', data)} className="block focus-visible:outline-2 focus-visible:outline-sky-400">
      <img ref={imageRef} src={`/api/onewin?kind=image&lang=${creativeLanguage}`} alt={`1win · ${label} · 18+`} width={creativeLanguage === 'ar' ? 2000 : 1080} height={creativeLanguage === 'ar' ? 2000 : 1920} className="mx-auto block h-auto max-h-[calc(100dvh-130px)] w-full object-contain" loading="lazy" decoding="async" />
    </a>
  </aside>;
}

export default function OneWinAds({ mobile = false }) {
  const [policy, setPolicy] = useState(null);
  const { language } = useLanguage();
  const { pathname } = useLocation();
  useEffect(() => { let active = true; loadPolicy().then(p => { if (active) setPolicy(p); }); return () => { active = false; }; }, []);
  if (policy?.adsEnabled !== true) return null;
  let explicit = language !== 'ru';
  try { explicit ||= !!localStorage.getItem('esea-tracker-language'); } catch { /* Browser preference still works without storage. */ }
  const creativeLanguage = selectAdLanguage(language, explicit, navigator.languages || [navigator.language]);
  const props = { creativeLanguage, siteLanguage: language, country: policy.country, page: pathname };
  if (mobile) return <Banner {...props} placement="mobile_inline" className="mx-auto my-8 w-[min(65%,240px)] overflow-hidden rounded-xl border border-white/10 bg-[#05070a] min-[1200px]:hidden" />;
  const rail = 'fixed top-[84px] z-20 hidden overflow-hidden rounded-xl border border-white/5 bg-[#05070a] min-[1200px]:block min-[1200px]:w-[calc((100vw-960px)/2-24px)] min-[1360px]:w-[calc((100vw-1040px)/2-24px)] min-[1600px]:w-[calc((100vw-1120px)/2-24px)] min-[1850px]:w-[calc((100vw-1180px)/2-24px)]';
  return <><Banner {...props} placement="site_left_rail" className={`${rail} left-3`} /><Banner {...props} placement="site_right_rail" className={`${rail} right-3`} /></>;
}
