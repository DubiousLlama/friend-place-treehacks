/**
 * Generate notification message body using Anthropic API.
 * Prompt is a simple placeholder; can be refined later.
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
  /** For results_reminder: display name of the person we're notifying */
  recipientDisplayName?: string;
  /** For results_reminder: display names of the other players in the game (not the recipient). Used to personalize without spoiling. */
  otherPlayerNames?: string[];
  /** For results_reminder: total number of players in the game */
  totalPlayerCount?: number;
}

const API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-20250514";

export async function generateNotificationMessage(
  kind: NotificationKind,
  context: GameContext
): Promise<string | null> {
  if (!API_KEY) {
    console.warn("[ai] ANTHROPIC_API_KEY not set");
    return null;
  }

  const systemPrompt = `You write very short, friendly email/SMS-style reminders for a casual web game called Friend Place. Each message is one or two sentences max. No hashtags or marketing speak. Never reveal placements, scores, rankings, or where anyone was placed on the axes—only create curiosity so they open the app.`;
  const axes = `${context.axis_x_low}–${context.axis_x_high} and ${context.axis_y_low}–${context.axis_y_high}`;

  let userPrompt: string;
  switch (kind) {
    case "new_game_invite":
      userPrompt = `Someone added you to a Friend Place game. The axes are: ${axes}. Write a one-sentence teaser to get them to open the game (include the axes in a fun way).`;
      break;
    case "mid_game_nudge":
      userPrompt = `A Friend Place game is in progress. ${context.submittedCount} of ${context.totalCount} players have submitted. Axes: ${axes}. Write a one-sentence teaser for players who haven't submitted yet (don't name names, just hint that something is happening).`;
      break;
    case "results_reminder": {
      const names = context.otherPlayerNames?.length
        ? context.otherPlayerNames.join(", ")
        : "your friends";
      const nameHint =
        context.recipientDisplayName?.trim()
          ? ` The recipient's name is ${context.recipientDisplayName}.`
          : "";
      userPrompt = `A Friend Place game has ended. The axes were: ${axes}. There were ${context.totalPlayerCount ?? "several"} players; the others are: ${names}.${nameHint}

Write a short, personalized message (1–2 sentences) to get this person to open the app and view their results. You may mention the axes or the other players' names to create curiosity (e.g. "see where ${context.otherPlayerNames?.[0] ?? "they"} placed you"). Do NOT reveal any actual placements, scores, or rankings—only tease that the results are in and worth looking at.`;
      break;
    }
    default:
      userPrompt = `Friend Place reminder. Axes: ${axes}. Write one short friendly sentence encouraging them to check the game.`;
  }

  try {
    const res = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 128,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      }
    );
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
    console.error("[ai] generateNotificationMessage failed:", e);
    return null;
  }
}
