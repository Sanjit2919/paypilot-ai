"use client";

import { useEffect, useState, type RefObject } from "react";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Progress (0 → 1) through a pinned scroll scene.
 *
 * The wrapper is taller than the screen and holds a `sticky` child. Progress is
 * how far the wrapper has travelled past the top of the viewport, divided by its
 * extra height — so it reads 0 the moment the scene pins and exactly 1 the moment
 * it un-pins and the page continues.
 *
 * The raw value is eased toward on every animation frame, so mouse-wheel steps
 * and trackpad bursts both feel smooth. The easing loop only runs while the value
 * is still settling. Visitors who prefer reduced motion get the raw value.
 */
export function usePinnedProgress(ref: RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0;
    let shown = 0;
    let frame = 0;
    let last = 0;

    const measure = () => {
      const el = ref.current;
      if (!el) return 0;
      const travel = Math.max(1, el.offsetHeight - window.innerHeight);
      return clamp01(-el.getBoundingClientRect().top / travel);
    };

    const settle = (now: number) => {
      const seconds = last ? Math.min(64, now - last) / 1000 : 1 / 60;
      last = now;
      const diff = target - shown;
      if (Math.abs(diff) < 0.0008) {
        shown = target;
        setProgress(target);
        frame = 0;
        last = 0;
        return;
      }
      // Catch up faster when heading for either end, so the readout reaches exactly
      // 0% / 100% at the same moment the scene pins or un-pins.
      const rate = target === 0 || target === 1 ? 26 : 15;
      shown += diff * Math.min(1, seconds * rate);
      setProgress(shown);
      frame = requestAnimationFrame(settle);
    };

    const onScroll = () => {
      target = measure();
      if (reduce) {
        shown = target;
        setProgress(target);
        return;
      }
      if (!frame) frame = requestAnimationFrame(settle);
    };

    target = shown = measure();
    setProgress(target);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);

  return progress;
}
