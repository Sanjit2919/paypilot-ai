"use client";

import { useCallback, useEffect, useRef } from "react";

type PointerLike = { clientX: number; clientY: number; pointerType: string };

/**
 * Tells real mouse movement apart from the synthetic pointer events browsers fire
 * when content scrolls or animates underneath a cursor that is not moving.
 *
 * Without this, scrolling (or a revolving agent passing under a resting cursor)
 * would count as "hovering" — freezing the orbit or hijacking a preview while
 * the visitor is only scrolling. A move is real when the cursor's screen
 * position changed since the last pointer event.
 */
export function useRealPointerMove() {
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Runs after React's handlers (window is the last stop of the bubble phase),
    // so handlers always compare against the position before the current event.
    const record = (event: PointerEvent) => {
      last.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", record, { passive: true });
    return () => window.removeEventListener("pointermove", record);
  }, []);

  return useCallback((event: PointerLike) => {
    if (event.pointerType !== "mouse") return false;
    const previous = last.current;
    return !!previous && (Math.abs(previous.x - event.clientX) >= 1 || Math.abs(previous.y - event.clientY) >= 1);
  }, []);
}
