"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

type ScrollMotionOptions = {
  /** Elements that rise and fade in as they travel up the viewport. */
  selector: string;
  /** Scroll distance, in px, over which one element completes its travel. */
  distance?: number;
  /** How far below its resting place an element starts, in px. */
  shift?: number;
  /** Opacity an element starts from. */
  floor?: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Ties content to the scroll position, in both directions.
 *
 * - `selector` elements rise and fade in as they travel up the viewport, and sink
 *   back when scrolled the other way. `data-scroll-delay` (px) staggers a row.
 * - `[data-scroll-track]` receives `--track` (0-1): progress through that block.
 * - `[data-scroll-drift="0.2"]` moves at a fraction of the scroll speed.
 * - `[data-scroll-progress]` receives `--scroll-progress` (0-1), which reaches 1
 *   when `[data-scroll-end]` (the last thing on the page) comes into view.
 *
 * Content is visible by default: styles apply only while an element is
 * mid-travel, travel is shortened near the end of the page so nothing can stay
 * faded, and visitors who ask for reduced motion get the page with no effects.
 */
export function useScrollMotion(
  ref: RefObject<HTMLElement | null>,
  { selector, distance = 160, shift = 32, floor = 0.08 }: ScrollMotionOptions,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    root.style.setProperty("--scroll-shift", `${shift}px`);
    root.style.setProperty("--scroll-floor", String(floor));

    let items: HTMLElement[] = [];
    let tracks: HTMLElement[] = [];
    let drifters: HTMLElement[] = [];
    let progressBar: HTMLElement | null = null;
    let end: HTMLElement | null = null;
    const appliedShift = new WeakMap<HTMLElement, number>();
    const lastTravel = new WeakMap<HTMLElement, number>();
    const lastTrack = new WeakMap<HTMLElement, number>();
    let frame = 0;

    const collect = () => {
      items = Array.from(root.querySelectorAll<HTMLElement>(selector));
      tracks = Array.from(root.querySelectorAll<HTMLElement>("[data-scroll-track]"));
      drifters = Array.from(root.querySelectorAll<HTMLElement>("[data-scroll-drift]"));
      progressBar = root.querySelector<HTMLElement>("[data-scroll-progress]");
      end = root.querySelector<HTMLElement>("[data-scroll-end]");
    };

    const update = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const scrollY = window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;
      const remaining = Math.max(0, pageHeight - viewport - scrollY);
      const wide = window.innerWidth >= 768;

      // Read everything first, then write, so the browser lays out once per frame.
      const tops = items.map((el) => el.getBoundingClientRect().top - (appliedShift.get(el) ?? 0));
      const trackRects = tracks.map((el) => el.getBoundingClientRect());
      const endTop = end ? end.getBoundingClientRect().top + scrollY : pageHeight;

      items.forEach((el, index) => {
        const delay = wide ? Number(el.dataset.scrollDelay) || 0 : 0;
        const line = viewport * 0.96 - delay;
        const top = tops[index];
        // An element near the end of the page can never travel the full distance,
        // so its travel is shortened to what the page allows.
        const reachable = line - (top - remaining);
        const span = Math.min(distance, reachable);
        const linear = span <= 1 ? 1 : clamp01((line - top) / span);
        const eased = linear * (2 - linear);
        const travel = eased >= 0.998 ? 1 : eased;

        const previous = lastTravel.get(el);
        if (previous !== undefined && (previous === travel || (travel < 1 && Math.abs(previous - travel) < 0.002))) return;
        lastTravel.set(el, travel);

        if (travel === 1) {
          el.removeAttribute("data-scroll-moving");
          el.style.setProperty("--t", "1");
          appliedShift.set(el, 0);
        } else {
          el.style.setProperty("--t", travel.toFixed(3));
          el.setAttribute("data-scroll-moving", "");
          appliedShift.set(el, (1 - travel) * shift);
        }
      });

      tracks.forEach((el, index) => {
        const rect = trackRects[index];
        const from = viewport * 0.82;
        const total = rect.height + viewport * 0.3;
        const best = (from - (rect.top - remaining)) / total;
        let progress = (from - rect.top) / total;
        if (best > 0 && best < 1) progress /= best;
        const value = Number(clamp01(progress).toFixed(3));
        if (lastTrack.get(el) === value) return;
        lastTrack.set(el, value);
        el.style.setProperty("--track", String(value));
      });

      const driftBase = Math.min(scrollY, 1400);
      for (const el of drifters) {
        el.style.translate = `0 ${(driftBase * (Number(el.dataset.scrollDrift) || 0)).toFixed(1)}px`;
      }

      if (progressBar) {
        progressBar.style.setProperty("--scroll-progress", clamp01(scrollY / Math.max(1, endTop - viewport)).toFixed(4));
      }
      const scrolled = scrollY > 8 ? "true" : "false";
      if (root.dataset.scrolled !== scrolled) root.dataset.scrolled = scrolled;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const rescan = () => {
      collect();
      schedule();
    };

    collect();
    update();

    const mutations = new MutationObserver(rescan);
    mutations.observe(root, { childList: true, subtree: true });
    const resizes = new ResizeObserver(schedule);
    resizes.observe(root);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("load", schedule);
    void document.fonts?.ready.then(schedule);

    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resizes.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("load", schedule);
      for (const el of items) {
        el.removeAttribute("data-scroll-moving");
        el.style.removeProperty("--t");
      }
      for (const el of tracks) el.style.removeProperty("--track");
      for (const el of drifters) el.style.removeProperty("translate");
      root.style.removeProperty("--scroll-shift");
      root.style.removeProperty("--scroll-floor");
      delete root.dataset.scrolled;
    };
  }, [ref, selector, distance, shift, floor]);
}

/** Wraps a page so everything marked `data-scroll` inside it follows the scroll position. */
export function ScrollStage({
  children,
  className,
  selector = "[data-scroll]",
  distance,
  shift,
  floor,
}: {
  children: ReactNode;
  className?: string;
  selector?: string;
  distance?: number;
  shift?: number;
  floor?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollMotion(ref, { selector, distance, shift, floor });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
