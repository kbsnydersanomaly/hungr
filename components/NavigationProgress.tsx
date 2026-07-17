"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const TRICKLE_INTERVAL_MS = 300;
const MAX_DURATION_MS = 8000;
const DONE_WIDTH = 100;

function isInternalNavClick(event: MouseEvent, currentPathname: string): boolean {
  // Ignore clicks with modifier keys (new tab/window) and non-left clicks.
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const anchor = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
  if (!anchor) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const url = new URL(anchor.getAttribute("href") ?? "", window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Same page (pure hash change or identical URL): no navigation will happen.
  if (
    url.pathname === currentPathname &&
    url.search === window.location.search
  ) {
    return false;
  }
  return true;
}

/**
 * Thin progress bar pinned to the top of the viewport, shown during
 * client-side navigations. Starts on internal link clicks and history
 * back/forward, completes when the pathname commits. Complements the
 * route-level loading.tsx fallbacks, which only cover their own segment.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  function clearTimers() {
    if (trickleRef.current) clearInterval(trickleRef.current);
    trickleRef.current = null;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  function start() {
    clearTimers();
    setVisible(true);
    setWidth(10);
    trickleRef.current = setInterval(() => {
      // Creep toward 85% so the bar never appears "done" mid-navigation.
      setWidth((w) => (w >= 85 ? w : w + Math.max(0.5, (85 - w) * 0.1)));
    }, TRICKLE_INTERVAL_MS);
    // Failsafe: never leave the bar running if a navigation is aborted.
    timersRef.current.push(setTimeout(complete, MAX_DURATION_MS));
  }

  function complete() {
    clearTimers();
    setWidth(DONE_WIDTH);
    timersRef.current.push(
      setTimeout(() => setVisible(false), 200),
      setTimeout(() => setWidth(0), 500)
    );
  }

  // Complete the bar once the navigation commits (pathname changes).
  useEffect(() => {
    complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (isInternalNavClick(event, pathnameRef.current)) start();
    }
    function onPopState() {
      start();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 bg-primary transition-[width] duration-300 ease-out"
      style={{ width: `${width}%` }}
    />
  );
}
