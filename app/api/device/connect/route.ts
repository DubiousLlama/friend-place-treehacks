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
    // Degrade gracefully in prod when Supabase admin/device_daily_usage isn't configured
    console.error("[device/connect] error:", err);
    return NextResponse.json({ ok: true });
  }
}
