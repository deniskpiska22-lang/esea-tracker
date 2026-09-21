import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

function getCounterId() {
  const counterId = Number(
    window.__YANDEX_METRIKA_ID__ || import.meta.env.VITE_YANDEX_METRIKA_ID
  );
  return Number.isInteger(counterId) && counterId > 0 ? counterId : null;
}

export default function YandexMetrika() {
  const location = useLocation();
  const initialPageRef = useRef(true);
  const previousUrlRef = useRef(window.location.href);
  const counterId = getCounterId();

  useEffect(() => {
    if (!counterId || typeof window.ym !== "function") return undefined;

    const currentUrl = window.location.href;

    // The snippet in index.html already records the first page view.
    if (initialPageRef.current) {
      initialPageRef.current = false;
      previousUrlRef.current = currentUrl;
      return undefined;
    }

    const previousUrl = previousUrlRef.current;
    const timer = window.setTimeout(() => {
      window.ym(counterId, "hit", currentUrl, {
        referer: previousUrl,
        title: document.title,
      });
      previousUrlRef.current = currentUrl;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [counterId, location.hash, location.pathname, location.search]);

  return null;
}
