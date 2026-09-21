import { useEffect, useMemo, useRef } from "react";

const PARI_OFFER_URL =
  "https://clicks.af-pb06e2.com/click?offer_id=812&partner_id=34440&landing_id=88&utm_medium=affiliate";

function sendAnalyticsEvent(eventName, placement) {
  if (typeof window === "undefined") {
    return;
  }

  const eventData = {
    placement,
    creative: "pari_cs2_freebet_5x1000",
  };

  const metrikaId = Number(
    window.__YANDEX_METRIKA_ID__ || import.meta.env.VITE_YANDEX_METRIKA_ID
  );

  if (Number.isFinite(metrikaId) && metrikaId > 0 && typeof window.ym === "function") {
    window.ym(metrikaId, "reachGoal", eventName, eventData);
  }

  window.dataLayer?.push({
    event: eventName,
    ...eventData,
  });
}

function PariBanner({ placement, className = "" }) {
  const bannerRef = useRef(null);

  const href = useMemo(() => {
    const url = new URL(PARI_OFFER_URL);
    url.searchParams.set("utm_source", "esea_tracker");
    url.searchParams.set("utm_campaign", "pari_cs2_test");
    url.searchParams.set("utm_content", placement);
    return url.toString();
  }, [placement]);

  useEffect(() => {
    const banner = bannerRef.current;

    if (!banner || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          sendAnalyticsEvent("pari_banner_view", placement);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(banner);

    return () => observer.disconnect();
  }, [placement]);

  return (
    <aside
      ref={bannerRef}
      className={`overflow-hidden rounded-[24px] border border-[#23e8cf]/25 bg-[#080d11] shadow-[0_18px_55px_rgba(0,0,0,0.25)] ${className}`}
      aria-label="Реклама PARI"
    >
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="group relative block overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#23e8cf] focus-visible:ring-inset"
        onClick={() => sendAnalyticsEvent("pari_banner_click", placement)}
      >
        <span className="absolute left-2 top-2 z-10 rounded-full border border-white/25 bg-black/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white backdrop-blur sm:left-3 sm:top-3">
          Реклама · 18+
        </span>

        <picture>
          <source
            media="(max-width: 639px)"
            srcSet="/ads/pari/pari-cs2-freebet-square.jpg"
          />
          <img
            src="/ads/pari/pari-cs2-freebet-legal.jpg"
            alt="PARI — фрибет 5×1000 рублей новым игрокам"
            className="block h-auto w-full transition duration-300 group-hover:scale-[1.015] group-hover:brightness-110"
            loading="lazy"
            decoding="async"
          />
        </picture>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black px-3 py-2.5 sm:px-4">
          <p className="min-w-0 text-[9px] leading-relaxed text-slate-400 sm:text-[10px]">
            Реклама. 18+. ООО «БК «ПАРИ», ИНН 7703365167. Условия акции и
            информация об организаторе — на рекламируемом сайте.
          </p>
          <span className="shrink-0 rounded-lg bg-[#28e5cd] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#06120f] transition group-hover:bg-white sm:px-4 sm:text-xs">
            Получить
          </span>
        </div>
      </a>
    </aside>
  );
}

export default PariBanner;
