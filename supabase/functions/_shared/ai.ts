/**
 * Generate notification message: static part (axes + context) + AI-generated quip.
 * Axes and core info are always in the static part; Anthropic only generates a short tease.
 */

export type NotificationKind = "mid_game_nudge" | "new_game_invite" | "results_reminder";

export interface GameContext {
  axis_x_low: string;
  axis_x_high: string;
  axis_y_low: string;
  axis_y_high: string;
  playerNames?: string[];
  submittedCount?: number;
  totalCount?: number;
  inviteCode?: string;
  recipientDisplayName?: string;
  otherPlayerNames?: string[];
  totalPlayerCount?: number;
}

const API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-20250514";

const axesString = (c: GameContext) =>
  `${c.axis_x_low} ↔ ${c.axis_x_high} / ${c.axis_y_low} ↔ ${c.axis_y_high}`;

/** Build the play URL for this game. Requires APP_URL and inviteCode in context / env. */
function playUrl(inviteCode: string | undefined): string | null {
  const base = Deno.env.get("APP_URL");
  if (!base?.trim() || !inviteCode?.trim()) return null;
  const url = base.replace(/\/$/, "");
  return `${url}/play/${inviteCode.trim()}`;
}

/** Static first part of the message (axes + kind-specific line + link). Same every time for the same context. */
export function buildStaticNotificationPart(kind: NotificationKind, context: GameContext): string {
  const axes = axesString(context);
  const link = playUrl(context.inviteCode);
  let lines: string[] = [];
  switch (kind) {
    case "new_game_invite":
      lines = [`You're in a new FriendPlace game. Axes: ${axes}.`];
      break;
    case "mid_game_nudge":
      lines = [`${context.submittedCount} of ${context.totalCount} have submitted. Axes: ${axes}.`];
      break;
    case "results_reminder":
      lines = [`Your FriendPlace game has results. Axes: ${axes}.`];
      break;
    default:
      lines = [`FriendPlace. Axes: ${axes}.`];
  }
  if (link) {
    lines.push("", `Play: ${link}`);
  }
  return lines.join("\n");
}

/** Fallback quips when AI is unavailable. */
const FALLBACK_QUIPS: Record<NotificationKind, string> = {
  new_game_invite: "Place yourself and see where your friends put you.",
  mid_game_nudge: "Don't miss out—add your picks and see how it's going.",
  results_reminder: "See how your friends placed you and who knew you best.",
};

/**
 * Generate the full message: static part (axes + info) + one AI-generated quip.
 * If AI fails, uses static part + fallback quip.
 */
export async function generateNotificationMessage(
  kind: NotificationKind,
  context: GameContext
): Promise<string | null> {
  const staticPart = buildStaticNotificationPart(kind, context);
  const quip = await generateQuip(kind, context);
  const line = quip ?? FALLBACK_QUIPS[kind];
  return `${staticPart}\n\n${line}`;
}

/** Ask Anthropic for one short quip/tease sentence only. No axes in the output—we add that statically. */
async function generateQuip(kind: NotificationKind, context: GameContext): Promise<string | null> {
  if (!API_KEY) {
    console.warn("[ai] ANTHROPIC_API_KEY not set");
    return null;
  }

  const systemPrompt = `You write one short, punchy sentence (a "quip" or tease) for a casual web game called FriendPlace. No hashtags or marketing speak. Never reveal placements, scores, rankings, or where anyone was placed—only create curiosity. Output ONLY that one sentence, nothing else. Do not repeat axis names or game info; the user already gets that in a separate line.`;

  let userPrompt: string;
  switch (kind) {
    case "new_game_invite":
      userPrompt = `Someone added them to a new game. Write one short, fun sentence to get them to open the app and place themselves (e.g. a light tease or dare).`;
      break;
    case "mid_game_nudge":
      userPrompt = `They haven't submitted yet; ${context.submittedCount} of ${context.totalCount} have. Write one short sentence to nudge them (don't name who submitted, just create FOMO or curiosity).`;
      break;
    case "results_reminder": {
      const names = context.otherPlayerNames?.length
        ? context.otherPlayerNames.join(", ")
        : "their friends";
      const nameHint = context.recipientDisplayName?.trim()
        ? ` Recipient is ${context.recipientDisplayName}; other players: ${names}.`
        : ` Other players: ${names}.`;
      userPrompt = `The game has ended and they haven't viewed results yet.${nameHint} Write one short, personalized tease to get them to open the app (e.g. mention seeing where friends placed them, or who got it right—but do NOT reveal any actual placements or scores).`;
      break;
    }
    default:
      userPrompt = `Write one short friendly sentence encouraging them to check the game.`;
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 80,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[ai] Anthropic error:", res.status, err);
      return null;
    }
    const data = await res.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
    const text = textBlock?.text?.trim();
    return text ?? null;
  } catch (e) {
    console.error("[ai] generateQuip failed:", e);
    return null;
  }
}
