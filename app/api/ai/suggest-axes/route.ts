import { NextRequest, NextResponse } from "next/server";
import { isAIAvailable } from "@/lib/ai/config";
import { generateText, parseAxisLines } from "@/lib/ai/provider";
import {
  AXIS_SYSTEM_PROMPT,
  buildRegenerateOneAxisPrompt,
  type AxisSuggestion,
} from "@/lib/ai/prompts";

type AxisKind = "horizontal" | "vertical";

const isDev = process.env.NODE_ENV === "development";

function json500(message: string, detail?: string) {
  return NextResponse.json(
    { error: message, ...(isDev && detail ? { detail } : {}) },
    { status: 500 },
  );
}

/**
 * POST /api/ai/suggest-axes
 *
 * Generates a fresh axis suggestion. Per-axis mode: pass axis to regenerate only that pair.
 *
 * Body:
 *   axis: "horizontal" | "vertical" — which axis to regenerate (default: both for backwards compat)
 *   currentAxes: { x_low, x_high, y_low, y_high } — current values (other axis is included in prompt)
 *   dailyAxes?: AxisSuggestion
 *   previousPair?: { low, high } — last generated pair for this axis (avoid repeat)
 *   pastGameAxes?: string[] — axis pairs from user's past games (e.g. ["Gimli ↔ Legolas | Muffin ↔ Pancake"])
 */
export async function POST(request: NextRequest) {
  if (!isAIAvailable()) {
    return NextResponse.json(
      { error: "AI features are not available" },
      { status: 503 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const axis = (body.axis as AxisKind) || "horizontal";
    const currentAxes = body.currentAxes as AxisSuggestion | undefined;
    const dailyAxes = body.dailyAxes as AxisSuggestion | undefined;
    const previousPair = body.previousPair as { low: string; high: string } | undefined;
    const pastGameAxes = body.pastGameAxes as string[] | undefined;

    if (!currentAxes?.x_low || currentAxes.x_high == null || currentAxes.y_low == null || currentAxes.y_high == null) {
      return NextResponse.json(
        { error: "currentAxes (x_low, x_high, y_low, y_high) is required" },
        { status: 400 },
      );
    }

    const otherAxis =
      axis === "horizontal"
        ? { low: currentAxes.y_low, high: currentAxes.y_high }
        : { low: currentAxes.x_low, high: currentAxes.x_high };

    const userPrompt = buildRegenerateOneAxisPrompt(axis, {
      otherAxis,
      dailyAxes: dailyAxes ?? null,
      previousPair: previousPair ?? null,
      pastGameAxes: pastGameAxes?.length ? pastGameAxes : undefined,
    });

    const raw = await generateText(AXIS_SYSTEM_PROMPT, userPrompt);
    if (!raw) {
      console.error("[suggest-axes] generateText returned null. Check: ANTHROPIC_API_KEY, model id, network.");
      return json500(
        "Failed to generate axes. Try again or enter your own!",
        "generateText returned null (see server terminal for [ai/provider] logs)",
      );
    }

    if (axis === "horizontal") {
      const result = parseAxisLines(raw, "horizontal");
      if (!result) {
        console.error("[suggest-axes] parseAxisLines failed. Raw response:", raw.slice(0, 400));
        return json500(
          "Failed to generate axes. Try again or enter your own!",
          `parse failed. Raw (first 300 chars): ${raw.slice(0, 300)}`,
        );
      }
      const xLow = result.x_low?.trim();
      const xHigh = result.x_high?.trim();
      if (!xLow || !xHigh) {
        console.error("[suggest-axes] horizontal response missing fields:", result);
        return json500("Failed to generate horizontal axes", JSON.stringify(result));
      }
      return NextResponse.json({ x_low: xLow, x_high: xHigh });
    }

    const result = parseAxisLines(raw, "vertical");
    if (!result) {
      console.error("[suggest-axes] parseAxisLines failed. Raw response:", raw.slice(0, 400));
      return json500(
        "Failed to generate axes. Try again or enter your own!",
        `parse failed. Raw (first 300 chars): ${raw.slice(0, 300)}`,
      );
    }
    const yLow = result.y_low?.trim();
    const yHigh = result.y_high?.trim();
    if (!yLow || !yHigh) {
      console.error("[suggest-axes] vertical response missing fields:", result);
      return json500("Failed to generate vertical axes", JSON.stringify(result));
    }
    return NextResponse.json({ y_low: yLow, y_high: yHigh });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof Error && "code" in err ? (err as Error & { code?: string }).code : undefined;
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[suggest-axes] throw:", message, stack ?? "");

    if (code === "ANTHROPIC_CREDITS_LOW" || /credit|credits|upgrade|billing/i.test(message)) {
      return NextResponse.json(
        {
          error: "AI credits are low. Add credits in your Anthropic account (Plans & Billing) or try again later.",
          ...(isDev ? { detail: message } : {}),
        },
        { status: 402 },
      );
    }

    return json500(
      "Failed to generate axes",
      isDev ? `throw: ${message}` : undefined,
    );
  }
}
