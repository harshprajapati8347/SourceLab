"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  startNavigationProgress,
  subscribeNavigationStart,
} from "@/shared/lib/navigation-progress";

const SHOW_DELAY_MS = 150;
const HIDE_DELAY_MS = 200;
const STALL_TIMEOUT_MS = 8000;
const TRICKLE_CAP = 90;

type TimerIds = {
  show: number;
  hide: number;
  stall: number;
  frame: number;
};

/**
 * Thin amber bar fixed to the top of the viewport while a pathname change
 * is in flight. Fast navigations finish before it appears.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const visibleRef = useRef(false);
  const fromRef = useRef<string | null>(null);
  const idRef = useRef(0);
  const progressRef = useRef(0);
  const timers = useRef<TimerIds>({ show: 0, hide: 0, stall: 0, frame: 0 });

  const clearTimers = useCallback(() => {
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.hide);
    window.clearTimeout(timers.current.stall);
    window.cancelAnimationFrame(timers.current.frame);
    timers.current = { show: 0, hide: 0, stall: 0, frame: 0 };
  }, []);

  const settle = useCallback((id: number) => {
    if (id !== idRef.current) {
      return;
    }

    fromRef.current = null;
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.stall);
    window.cancelAnimationFrame(timers.current.frame);
    timers.current.show = 0;
    timers.current.stall = 0;
    timers.current.frame = 0;

    if (!visibleRef.current) {
      return;
    }

    progressRef.current = 100;
    setProgress(100);
    timers.current.hide = window.setTimeout(() => {
      if (id !== idRef.current) {
        return;
      }
      visibleRef.current = false;
      setVisible(false);
      progressRef.current = 0;
      setProgress(0);
    }, HIDE_DELAY_MS);
  }, []);

  const begin = useCallback(() => {
    const id = ++idRef.current;
    fromRef.current = pathnameRef.current;
    window.clearTimeout(timers.current.hide);
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.stall);
    window.cancelAnimationFrame(timers.current.frame);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(reduce);

    const reveal = () => {
      if (id !== idRef.current) {
        return;
      }

      visibleRef.current = true;
      setVisible(true);
      const initial = reduce ? 100 : 8;
      progressRef.current = initial;
      setProgress(initial);

      if (reduce) {
        return;
      }

      let last = performance.now();
      const step = (now: number) => {
        if (id !== idRef.current) {
          return;
        }
        const dt = Math.min(now - last, 50);
        last = now;
        const next = Math.min(
          TRICKLE_CAP,
          progressRef.current + (TRICKLE_CAP - progressRef.current) * (dt / 1200),
        );
        progressRef.current = next;
        setProgress(next);
        timers.current.frame = window.requestAnimationFrame(step);
      };
      timers.current.frame = window.requestAnimationFrame(step);
    };

    if (visibleRef.current) {
      reveal();
    } else {
      progressRef.current = 0;
      setProgress(0);
      timers.current.show = window.setTimeout(reveal, SHOW_DELAY_MS);
    }

    timers.current.stall = window.setTimeout(() => {
      settle(id);
    }, STALL_TIMEOUT_MS);
  }, [settle]);

  useEffect(() => {
    pathnameRef.current = pathname;
    if (fromRef.current === null || pathname === fromRef.current) {
      return;
    }
    settle(idRef.current);
  }, [pathname, settle]);

  useEffect(() => {
    return subscribeNavigationStart(begin);
  }, [begin]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      const element =
        target instanceof Element
          ? target
          : target instanceof Node
            ? target.parentElement
            : null;
      const anchor = element?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      if (!anchor.hasAttribute("href") || anchor.hasAttribute("download")) {
        return;
      }
      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      startNavigationProgress(anchor.href);
    }

    function onPopState() {
      if (window.location.pathname !== pathnameRef.current) {
        startNavigationProgress();
      }
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={reducedMotion ? undefined : Math.round(progress)}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div
        className="h-full bg-primary"
        style={{ width: reducedMotion ? "100%" : `${progress}%` }}
      />
    </div>
  );
}
