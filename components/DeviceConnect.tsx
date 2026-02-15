"use client";

import { useEffect } from "react";

/**
 * Calls /api/device/connect once on mount to log device info and ensure
 * today's usage row exists for rate limiting. Fire-and-forget; does not block render.
 */
export function DeviceConnect() {
  useEffect(() => {
    fetch("/api/device/connect").catch(() => {});
  }, []);
  return null;
}
