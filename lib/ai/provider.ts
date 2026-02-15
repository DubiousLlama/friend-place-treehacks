import Anthropic from "@anthropic-ai/sdk";
import { aiConfig, isAIAvailable } from "./config";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: aiConfig.anthropicApiKey });
  }
  return _client;
}

/**
 * Generate raw text via Anthropic Claude.
 * Returns `null` when AI is disabled, key missing, or the request fails.
 */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  if (!isAIAvailable()) return null;

  try {
    const message = await getClient().messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
      max_tokens: 512,
      temperature: 0.95,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    return textBlock.text.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    console.error("[ai/provider] generation failed:", name, msg);
    if (err instanceof Error && err.stack) console.error("[ai/provider] stack:", err.stack);
    if (/credit balance|too low|upgrade|purchase credits/i.test(msg)) {
      const e = new Error("Anthropic API credits are low or exhausted. Add credits in Anthropic console (Plans & Billing).") as Error & { code?: string };
      e.code = "ANTHROPIC_CREDITS_LOW";
      throw e;
    }
    return null;
  }
}

/** Strip leading "1. " / "2. " / "- " etc. and trim */
function cleanLabel(s: string): string {
  return s.replace(/^[\d]+[.)]\s*/, "").replace(/^[-–—]\s*/, "").trim();
}

/**
 * Parse line- or comma-separated axis labels into a structured object.
 * Takes first N non-empty tokens (after trimming and stripping leading numbers).
 *
 * kind "full" → expect 4 values: x_low, x_high, y_low, y_high
 * kind "horizontal" → expect 2 values: x_low, x_high
 * kind "vertical" → expect 2 values: y_low, y_high
 */
export function parseAxisLines(
  text: string,
  kind: "full" | "horizontal" | "vertical",
):
  | { x_low: string; x_high: string; y_low: string; y_high: string }
  | { x_low: string; x_high: string }
  | { y_low: string; y_high: string }
  | null {
  const tokens = text
    .split(/[\r\n,]+/)
    .map((s) => cleanLabel(s))
    .filter(Boolean);

  if (kind === "full") {
    if (tokens.length < 4) {
      console.error("[ai/provider] parseAxisLines(full) expected 4 values, got:", tokens.length, "raw:", text.slice(0, 200));
      return null;
    }
    return {
      x_low: tokens[0],
      x_high: tokens[1],
      y_low: tokens[2],
      y_high: tokens[3],
    };
  }

  if (tokens.length < 2) {
    console.error("[ai/provider] parseAxisLines(" + kind + ") expected 2 values, got:", tokens.length, "raw:", text.slice(0, 200));
    return null;
  }

  if (kind === "horizontal") {
    return { x_low: tokens[0], x_high: tokens[1] };
  }
  return { y_low: tokens[0], y_high: tokens[1] };
}
