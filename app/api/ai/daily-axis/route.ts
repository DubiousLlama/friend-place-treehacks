import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAIAvailable } from "@/lib/ai/config";
import { generateText, parseAxisLines } from "@/lib/ai/provider";
import { AXIS_SYSTEM_PROMPT, buildDailyAxisPrompt, type AxisSuggestion } from "@/lib/ai/prompts";

/** Hardcoded fallbacks when AI is unavailable (metaphorical, one word or proper noun) */
const FALLBACK_AXES: AxisSuggestion[] = [
  { x_low: "Gimli", x_high: "Legolas", y_low: "Muffin", y_high: "Pancake" },
  { x_low: "Starbucks", x_high: "Dunkin", y_low: "Muffin", y_high: "Croissant" },
  { x_low: "Winter", x_high: "Summer", y_low: "Gimli", y_high: "Legolas" },
  { x_low: "Gimli", x_high: "Legolas", y_low: "Starbucks", y_high: "Dunkin" },
  { x_low: "Muffin", x_high: "Pancake", y_low: "Winter", y_high: "Summer" },
];

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function randomFallback(): AxisSuggestion {
  return FALLBACK_AXES[Math.floor(Math.random() * FALLBACK_AXES.length)];
}

/**
 * GET /api/ai/daily-axis
 *
 * Returns today's daily axes. Uses cache when SUPABASE_SERVICE_ROLE_KEY is available;
 * otherwise generates fresh (no DB). Group games use POST /api/ai/suggest-group-axes instead.
 */
export async function GET(request: NextRequest) {
  const today = getTodayDateString();

  try {
    let supabase: Awaited<ReturnType<typeof createAdminClient>> | null = null;
    try {
      supabase = createAdminClient();
    } catch {
      // No service role (e.g. prod): generate without cache
    }

    if (supabase) {
      const { data: existing, error: selectError } = await supabase
        .from("daily_axes")
        .select("axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
        .eq("date", today)
        .maybeSingle();

      if (!selectError && existing) {
        return NextResponse.json({
          x_low: existing.axis_x_label_low,
          x_high: existing.axis_x_label_high,
          y_low: existing.axis_y_label_low,
          y_high: existing.axis_y_label_high,
          source: "cached",
        });
      }

      // Fetch recent axes to avoid repeating (only when DB is available)
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

      if (isAIAvailable()) {
        const raw = await generateText(
          AXIS_SYSTEM_PROMPT,
          buildDailyAxisPrompt(recentDailyAxes.length ? recentDailyAxes : undefined),
        );
        const result = raw ? parseAxisLines(raw, "full") : null;
        if (result?.x_low && result.x_high && result.y_low && result.y_high) {
          await supabase.from("daily_axes").upsert(
            {
              date: today,
              axis_x_label_low: result.x_low,
              axis_x_label_high: result.x_high,
              axis_y_label_low: result.y_low,
              axis_y_label_high: result.y_high,
            },
            { onConflict: "date" },
          );
          return NextResponse.json({ ...result, source: "generated" });
        }
      }
    } else {
      // No DB: generate and return (no cache)
      if (isAIAvailable()) {
        const raw = await generateText(AXIS_SYSTEM_PROMPT, buildDailyAxisPrompt());
        const result = raw ? parseAxisLines(raw, "full") : null;
        if (result?.x_low && result.x_high && result.y_low && result.y_high) {
          return NextResponse.json({ ...result, source: "generated" });
        }
      }
    }

    const fb = randomFallback();
    return NextResponse.json({ ...fb, source: "fallback" });
  } catch (err) {
    console.error("[daily-axis] error:", err);
    const fb = randomFallback();
    return NextResponse.json({ ...fb, source: "fallback" });
  }
}
