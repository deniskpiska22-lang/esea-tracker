import { useEffect, useRef } from "react";

const PARI_OFFER_URL =
  "https://clicks.af-pb06e2.com/click?offer_id=812&partner_id=34440&landing_id=88&utm_medium=affiliate";

function sendAnalyticsEvent(eventName, placement) {
  if (typeof window === "undefined") {
    return;
  }

  const eventData = {
    placement,
    creative: "pari_cs2_side_rail",
  };
  const metrikaId = Number(
    window.__YANDEX_METRIKA_ID__ || import.meta.env.VITE_YANDEX_METRIKA_ID
  );

  if (Number.isFinite(metrikaId) && metrikaId > 0 && typeof window.ym === "function") {
    window.ym(metrikaId, "reachGoal", eventName, eventData);
  }

  window.dataLayer?.push({ event: eventName, ...eventData });
}

function SideRail({ side, imageSrc }) {
  const railRef = useRef(null);
  const placement = `site_${side}_rail`;

  useEffect(() => {
    const rail = railRef.current;

    if (!rail || typeof IntersectionObserver === "undefined") {
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

    observer.observe(rail);
    return () => observer.disconnect();
  }, [placement]);

  return (
    <aside
      ref={railRef}
      className={`fixed bottom-0 top-[72px] z-20 hidden bg-[#05070a] min-[1200px]:block min-[1200px]:w-[calc((100vw-960px)/2)] min-[1360px]:w-[calc((100vw-1040px)/2)] min-[1600px]:w-[calc((100vw-1120px)/2)] min-[1850px]:w-[calc((100vw-1180px)/2)] ${
        side === "left" ? "left-0" : "right-0"
      }`}
      aria-label="Реклама PARI"
    >
      <a
        href={PARI_OFFER_URL}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="group relative block h-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#28e5cd] focus-visible:ring-inset"
        onClick={() => sendAnalyticsEvent("pari_banner_click", placement)}
      >
        <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 to-transparent px-2 pb-5 pt-2 text-center text-[7px] font-black uppercase tracking-[0.16em] text-white/70 min-[1600px]:text-[8px]">
          Реклама · 18+
        </div>
        <img
          src={imageSrc}
          alt="PARI — фрибет 5×1000 рублей новым игрокам"
          width="640"
          height="1800"
          className="block h-full w-full object-cover object-top transition duration-300 group-hover:brightness-110"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-1.5 pb-2 pt-8 text-center text-[6px] leading-tight text-white/55 min-[1600px]:text-[7px]">
          ООО «БК «ПАРИ» · ИНН 7703365167
        </div>
      </a>
    </aside>
  );
}

function PariSideRails() {
  return (
    <>
      <SideRail
        side="left"
        imageSrc="/ads/pari/pari-cs2-side-left.jpg"
      />
      <SideRail
        side="right"
        imageSrc="/ads/pari/pari-cs2-side-right.jpg"
      />
    </>
  );
}

export default PariSideRails;
