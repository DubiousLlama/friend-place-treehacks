import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAIAvailable } from "@/lib/ai/config";
import { generateText, parseAxisLines } from "@/lib/ai/provider";
import {
  AXIS_SYSTEM_PROMPT,
  buildDailyAxisPrompt,
  buildGroupAxesPrompt,
  type AxisSuggestion,
} from "@/lib/ai/prompts";

/** Hardcoded fallbacks when AI is unavailable (metaphorical, one word or proper noun) */
const FALLBACK_AXES: AxisSuggestion[] = [
  { x_low: "Gimli", x_high: "Legolas", y_low: "Muffin", y_high: "Pancake" },
  { x_low: "Starbucks", x_high: "Dunkin", y_low: "Muffin", y_high: "Croissant" },
  { x_low: "Winter", x_high: "Summer", y_low: "Gimli", y_high: "Legolas" },
  { x_low: "Gimli", x_high: "Legolas", y_low: "Starbucks", y_high: "Dunkin" },
  { x_low: "Muffin", x_high: "Pancake", y_low: "Winter", y_high: "Summer" },
];

function getTodayDateString(): string {
  // UTC date string: YYYY-MM-DD
  return new Date().toISOString().slice(0, 10);
}

function randomFallback(): AxisSuggestion {
  return FALLBACK_AXES[Math.floor(Math.random() * FALLBACK_AXES.length)];
}

/**
 * GET /api/ai/daily-axis
 *
 * Returns today's daily axis. Generates + caches on first request of the day.
 * Query: group_id — if present and the group has interests, generates axes from group interests (no cache).
 */
export async function GET(request: NextRequest) {
  const today = getTodayDateString();
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group_id") ?? undefined;

  try {
    // Group path: always generate new axes for this game (never use global daily cache)
    if (groupId) {
      let supabase;
      try {
        supabase = createAdminClient();
      } catch (adminErr) {
        console.error("[daily-axis] createAdminClient failed (missing SUPABASE_SERVICE_ROLE_KEY?):", adminErr);
        const fb = randomFallback();
        return NextResponse.json({ ...fb, source: "fallback" });
      }
      const { data: group, error: groupError } = await supabase
        .from("saved_groups")
        .select("interests")
        .eq("id", groupId)
        .maybeSingle();

      if (!isAIAvailable()) {
        const fb = randomFallback();
        return NextResponse.json({ ...fb, source: "fallback" });
      }

      if (!groupError && group?.interests?.length) {
        const raw = await generateText(
          AXIS_SYSTEM_PROMPT,
          buildGroupAxesPrompt({ groupInterests: group.interests }),
        );
        const result = raw ? parseAxisLines(raw, "full") : null;
        if (result?.x_low && result.x_high && result.y_low && result.y_high) {
          return NextResponse.json({ ...result, source: "group" });
        }
      }
      // No interests or group not found: still generate fresh axes (not global daily)
      const raw = await generateText(
        AXIS_SYSTEM_PROMPT,
        buildDailyAxisPrompt(),
      );
      const result = raw ? parseAxisLines(raw, "full") : null;
      if (result?.x_low && result.x_high && result.y_low && result.y_high) {
        return NextResponse.json({ ...result, source: "group" });
      }
      const fb = randomFallback();
      return NextResponse.json({ ...fb, source: "fallback" });
    }

    const supabase = createAdminClient();

    // Check if today's axis already exists (use maybeSingle so 0 rows is not an error)
    const { data: existing, error: selectError } = await supabase
      .from("daily_axes")
      .select("axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
      .eq("date", today)
      .maybeSingle();

    if (selectError) {
      console.error("[daily-axis] select error (is daily_axes table created? run migration):", selectError);
      // Fall through to generate + fallback if we can't read DB
    } else if (existing) {
      return NextResponse.json({
        x_low: existing.axis_x_label_low,
        x_high: existing.axis_x_label_high,
        y_low: existing.axis_y_label_low,
        y_high: existing.axis_y_label_high,
        source: "cached",
      });
    }

    // Generate via AI
    if (!isAIAvailable()) {
      const fb = randomFallback();
      return NextResponse.json({ ...fb, source: "fallback" });
    }

    // Fetch last 7 days of daily axes (excluding today) so we avoid repeating
    let recentDailyAxes: string[] = [];
    if (!selectError) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
      const { data: recent } = await supabase
        .from("daily_axes")
        .select("axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
        .lt("date", today)
        .gte("date", sevenDaysAgo.toISOString().slice(0, 10))
        .order("date", { ascending: false })
        .limit(7);
      if (recent?.length) {
        recentDailyAxes = recent.map(
          (r) =>
            `${r.axis_x_label_low} ↔ ${r.axis_x_label_high} | ${r.axis_y_label_low} ↔ ${r.axis_y_label_high}`,
        );
      }
    }

    const raw = await generateText(
      AXIS_SYSTEM_PROMPT,
      buildDailyAxisPrompt(recentDailyAxes.length ? recentDailyAxes : undefined),
    );
    const result = raw ? parseAxisLines(raw, "full") : null;

    if (!result || !result.x_low || !result.x_high || !result.y_low || !result.y_high) {
      const fb = randomFallback();
      return NextResponse.json({ ...fb, source: "fallback" });
    }

    // Store in DB for the rest of the day (required for cache; service role bypasses RLS)
    const { error: upsertError } = await supabase.from("daily_axes").upsert(
      {
        date: today,
        axis_x_label_low: result.x_low,
        axis_x_label_high: result.x_high,
        axis_y_label_low: result.y_low,
        axis_y_label_high: result.y_high,
      },
      { onConflict: "date" },
    );

    if (upsertError) {
      console.error("[daily-axis] upsert error (run migration 20260214400000_daily_axes):", upsertError);
      // Still return generated axes; next request will regenerate until DB is fixed
    }

    return NextResponse.json({ ...result, source: "generated" });
  } catch (err) {
    console.error("[daily-axis] error:", err);
    const fb = randomFallback();
    return NextResponse.json({ ...fb, source: "fallback" });
  }
}
