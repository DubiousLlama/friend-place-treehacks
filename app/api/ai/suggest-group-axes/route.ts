import { NextRequest, NextResponse } from "next/server";
import { isAIAvailable } from "@/lib/ai/config";
import { generateText, parseAxisLines } from "@/lib/ai/provider";
import {
  AXIS_SYSTEM_PROMPT,
  buildDailyAxisPrompt,
  buildGroupAxesPrompt,
  type AxisSuggestion,
} from "@/lib/ai/prompts";

/** Fallbacks when AI is unavailable (no Supabase or DB required) */
const FALLBACK_AXES: AxisSuggestion[] = [
  { x_low: "Gimli", x_high: "Legolas", y_low: "Muffin", y_high: "Pancake" },
  { x_low: "Starbucks", x_high: "Dunkin", y_low: "Muffin", y_high: "Croissant" },
  { x_low: "Winter", x_high: "Summer", y_low: "Gimli", y_high: "Legolas" },
  { x_low: "Muffin", x_high: "Pancake", y_low: "Winter", y_high: "Summer" },
];

function randomFallback(): AxisSuggestion {
  return FALLBACK_AXES[Math.floor(Math.random() * FALLBACK_AXES.length)];
}

/**
 * POST /api/ai/suggest-group-axes
 *
 * Generates axis labels for a new game (e.g. for a group). No Supabase/DB — client sends
 * groupInterests when it has them (from its own RLS-scoped fetch). Works in prod without
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Body: { groupInterests?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const groupInterests = body.groupInterests as string[] | undefined;
    const hasInterests = Array.isArray(groupInterests) && groupInterests.length > 0;

    if (!isAIAvailable()) {
      const fb = randomFallback();
      return NextResponse.json({ ...fb, source: "fallback" });
    }

    const prompt = hasInterests
      ? buildGroupAxesPrompt({ groupInterests })
      : buildDailyAxisPrompt();
    const raw = await generateText(AXIS_SYSTEM_PROMPT, prompt);
    const result = raw ? parseAxisLines(raw, "full") : null;

    if (result?.x_low && result.x_high && result.y_low && result.y_high) {
      return NextResponse.json({
        ...result,
        source: hasInterests ? "group" : "generated",
      });
    }

    const fb = randomFallback();
    return NextResponse.json({ ...fb, source: "fallback" });
  } catch (err) {
    console.error("[suggest-group-axes] error:", err);
    const fb = randomFallback();
    return NextResponse.json({ ...fb, source: "fallback" });
  }
}
