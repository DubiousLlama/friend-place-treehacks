import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  type NotificationKind,
  type GameContext,
  buildStaticNotificationPart,
  buildQuipUserPrompt,
  getSystemPrompt,
  FALLBACK_QUIPS,
  defaultContext,
} from "@/lib/notifications/prompts";
import { aiConfig, isAIAvailable } from "@/lib/ai/config";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
const SUBJECT_PREFIX = process.env.RESEND_SUBJECT_PREFIX ?? "FriendPlace: ";

/**
 * Preview notification email content without sending.
 * Uses the same prompts as the Supabase Edge Functions.
 *
 * POST /api/notifications/preview
 * Body: { "kind": "new_game_invite" | "mid_game_nudge" | "results_reminder", "context"?: Partial<GameContext> }
 *
 * Returns: { kind, staticPart, quip, fullMessage, subject, usedFallback }
 */
export async function POST(req: Request) {
  if (!isAIAvailable()) {
    return NextResponse.json(
      { error: "AI not available. Set ANTHROPIC_API_KEY in .env.local and ensure AI_ENABLED is not false." },
      { status: 503 }
    );
  }

  let body: { kind?: string; context?: Partial<GameContext> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const kind = body?.kind as NotificationKind | undefined;
  const validKinds: NotificationKind[] = ["new_game_invite", "mid_game_nudge", "results_reminder"];
  if (!kind || !validKinds.includes(kind)) {
    return NextResponse.json(
      { error: `Body must include 'kind': one of ${validKinds.join(", ")}` },
      { status: 400 }
    );
  }

  const context = defaultContext(body?.context ?? {});
  const appUrl =
    process.env.APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "https://example.com");

  const staticPart = buildStaticNotificationPart(kind, context, appUrl);
  const userPrompt = buildQuipUserPrompt(kind, context);
  const systemPrompt = getSystemPrompt();

  let quip: string | null = null;
  try {
    const client = new Anthropic({ apiKey: aiConfig.anthropicApiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 80,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text" && textBlock.text?.trim()) {
      quip = textBlock.text.trim();
    }
  } catch (e) {
    console.error("[notifications/preview] Anthropic error:", e);
  }

  const usedFallback = quip === null;
  const finalQuip = quip ?? FALLBACK_QUIPS[kind];
  const fullMessage = `${staticPart}\n\n${finalQuip}`;

  return NextResponse.json({
    kind,
    staticPart,
    quip: finalQuip,
    usedFallback,
    fullMessage,
    subject: `${SUBJECT_PREFIX}Game reminder`,
    /** Prompts sent to the model (for debugging). */
    _debug: { systemPrompt, userPrompt },
  });
}
