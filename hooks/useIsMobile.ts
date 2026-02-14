"use client";

import { useState, useEffect } from "react";

/**
 * Returns `true` when the viewport is narrower than `breakpoint` pixels.
 *
 * SSR-safe: defaults to `false` on the server / first render.
 * Updates reactively when the viewport crosses the breakpoint.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
