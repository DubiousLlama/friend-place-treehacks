import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayUTC } from "@/lib/device-usage";

const RETAIN_DAYS = 30;

/**
 * GET /api/cron/daily-usage-cleanup
 *
 * Vercel Cron: run daily. Deletes device_daily_usage rows older than RETAIN_DAYS
 * to cap storage. Secure: require CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = getTodayUTC();
    const cutoff = new Date(today);
    cutoff.setUTCDate(cutoff.getUTCDate() - RETAIN_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("device_daily_usage")
      .delete()
      .lt("date", cutoffStr)
      .select("device_key");

    if (error) {
      console.error("[daily-usage-cleanup] delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const deleted = Array.isArray(data) ? data.length : 0;
    return NextResponse.json({ deleted, cutoff: cutoffStr });
  } catch (err) {
    console.error("[daily-usage-cleanup] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
