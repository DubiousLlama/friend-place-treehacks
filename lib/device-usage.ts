import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Today's date in UTC (YYYY-MM-DD) for consistency with DB and cleanup cron. */
export function getTodayUTC(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

/**
 * Derive a stable device key from request headers (IP + User-Agent).
 * If headers are missing, fall back to a random-like key so we still rate-limit.
 */
export function getDeviceKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  const raw = `${ip}|${ua}`;
  if (!raw.trim() || raw === "|") {
    return createHash("sha256").update(`fallback-${Date.now()}-${Math.random()}`).digest("hex");
  }
  return createHash("sha256").update(raw).digest("hex");
}

export type DailyUsage = { axes_count: number; invite_count: number };

/**
 * Get or create today's usage row for this device. Optionally update user_agent/ip_address for logging.
 */
export async function getOrCreateDailyUsage(
  deviceKey: string,
  request?: NextRequest
): Promise<DailyUsage> {
  const today = getTodayUTC();
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("device_daily_usage")
    .select("axes_generation_count, invite_email_count")
    .eq("device_key", deviceKey)
    .eq("date", today)
    .maybeSingle();

  if (row) {
    if (request) {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        null;
      const ua = request.headers.get("user-agent") ?? null;
      await supabase
        .from("device_daily_usage")
        .update({
          user_agent: ua,
          ip_address: ip,
          updated_at: new Date().toISOString(),
        })
        .eq("device_key", deviceKey)
        .eq("date", today);
    }
    return {
      axes_count: row.axes_generation_count,
      invite_count: row.invite_email_count,
    };
  }

  const ip =
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request?.headers.get("x-real-ip") ??
    null;
  const ua = request?.headers.get("user-agent") ?? null;

  await supabase.from("device_daily_usage").insert({
    device_key: deviceKey,
    date: today,
    axes_generation_count: 0,
    invite_email_count: 0,
    user_agent: ua,
    ip_address: ip,
  });

  return { axes_count: 0, invite_count: 0 };
}

/** Increment axes generation count for today's row. */
export async function incrementAxesUsed(deviceKey: string): Promise<void> {
  const today = getTodayUTC();
  const supabase = createAdminClient();
  await supabase.rpc("increment_device_axes", { p_device_key: deviceKey, p_date: today });
}

/** Increment invite email count for today's row. */
export async function incrementInviteEmailsSent(deviceKey: string, count: number): Promise<void> {
  const today = getTodayUTC();
  const supabase = createAdminClient();
  await supabase.rpc("increment_device_invites", {
    p_device_key: deviceKey,
    p_date: today,
    p_count: count,
  });
}
