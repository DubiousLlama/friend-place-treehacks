import { NextRequest, NextResponse } from "next/server";
import { getDeviceKey, getOrCreateDailyUsage } from "@/lib/device-usage";

/**
 * GET /api/device/connect
 *
 * Called by the client once on app load. Logs device info and ensures today's
 * usage row exists for rate limiting. Idempotent; no auth required.
 */
export async function GET(request: NextRequest) {
  try {
    const deviceKey = getDeviceKey(request);
    await getOrCreateDailyUsage(deviceKey, request);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[device/connect] error:", err);
    return NextResponse.json({ error: "Failed to register device" }, { status: 500 });
  }
}
