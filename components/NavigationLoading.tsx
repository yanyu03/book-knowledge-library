"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const FALLBACK_DELAY = 12000;
const FINISH_DELAY = 140;

export default function NavigationLoading() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const pendingPath = useRef<string | null>(null);
  const fallbackTimer = useRef<number | null>(null);

  useEffect(() => {
    const destination = pendingPath.current;
    if (!destination || destination !== pathname) return;

    const finishTimer = window.setTimeout(() => {
      if (pendingPath.current !== pathname) return;
      pendingPath.current = null;
      setLoading(false);
      if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }, FINISH_DELAY);

    return () => window.clearTimeout(finishTimer);
  }, [pathname]);

  useEffect(() => {
    const startLoading = (destination: string) => {
      if (destination === window.location.pathname) return;
      pendingPath.current = destination;
      setLoading(true);

      if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = window.setTimeout(() => {
        pendingPath.current = null;
        setLoading(false);
        fallbackTimer.current = null;
      }, FALLBACK_DELAY);
    };

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      startLoading(url.pathname);
    };

    const handlePopState = () => {
      const destination = window.location.pathname;
      if (destination !== pathname) startLoading(destination);
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);
    };
  }, [pathname]);

  return (
    <div className={`route-loading ${loading ? "is-active" : ""}`} role="status" aria-live="polite" aria-hidden={!loading}>
      <div className="route-loading-card">
        <span className="route-loading-spinner" aria-hidden="true" />
        <span className="route-loading-label">正在打开</span>
        <span className="route-loading-dots" aria-hidden="true"><i /> <i /> <i /></span>
      </div>
    </div>
  );
}
