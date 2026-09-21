import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const UUID_PLAYER_PATH =
  /^\/(?:player|players)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i;

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
  const pendingPlayerUrlRef = useRef(null);
  const counterId = getCounterId();

  useEffect(() => {
    if (!counterId) return undefined;

    const handlePlayerSeoUpdate = (event) => {
      const pending = pendingPlayerUrlRef.current;
      const title = String(event.detail?.title || "").trim();
      const metadataPath = String(event.detail?.routePath || "").replace(
        /^\/player\//,
        "/players/"
      );
      const pendingPath = pending
        ? new URL(pending).pathname.replace(/^\/player\//, "/players/")
        : "";

      if (
        !pending ||
        typeof window.ym !== "function" ||
        !title ||
        metadataPath !== pendingPath ||
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
          title
        )
      ) {
        return;
      }

      window.ym(counterId, "hit", pending, {
        referer: previousUrlRef.current,
        title,
      });
      previousUrlRef.current = pending;
      pendingPlayerUrlRef.current = null;
    };

    window.addEventListener("player-seo-update", handlePlayerSeoUpdate);
    return () => {
      window.removeEventListener("player-seo-update", handlePlayerSeoUpdate);
    };
  }, [counterId]);

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
    if (UUID_PLAYER_PATH.test(location.pathname)) {
      pendingPlayerUrlRef.current = currentUrl;
      return undefined;
    }

    pendingPlayerUrlRef.current = null;
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
