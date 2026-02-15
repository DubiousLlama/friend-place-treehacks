/**
 * Notification copy and prompts — mirror of supabase/functions/_shared/ai.ts
 * so we can preview email content from the Next.js app without sending.
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

const axesString = (c: GameContext) =>
  `${c.axis_x_low} ↔ ${c.axis_x_high} / ${c.axis_y_low} ↔ ${c.axis_y_high}`;

function playUrl(inviteCode: string | undefined, appUrl: string): string | null {
  const base = appUrl?.trim();
  if (!base || !inviteCode?.trim()) return null;
  const url = base.replace(/\/$/, "");
  return `${url}/play/${inviteCode.trim()}`;
}

/** Static first part of the message (axes + kind-specific line + link). */
export function buildStaticNotificationPart(
  kind: NotificationKind,
  context: GameContext,
  appUrl: string
): string {
  const axes = axesString(context);
  const link = playUrl(context.inviteCode, appUrl);
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

export const FALLBACK_QUIPS: Record<NotificationKind, string> = {
  new_game_invite: "Place yourself and see where your friends put you.",
  mid_game_nudge: "Don't miss out—add your picks and see how it's going.",
  results_reminder: "See how your friends placed you and who knew you best.",
};

const SYSTEM_PROMPT = `You write one short, punchy sentence (a "quip" or tease) for a casual web game called FriendPlace. No hashtags or marketing speak. Never reveal placements, scores, rankings, or where anyone was placed—only create curiosity. Output ONLY that one sentence, nothing else. Do not repeat axis names or game info; the user already gets that in a separate line.`;

export function buildQuipUserPrompt(kind: NotificationKind, context: GameContext): string {
  switch (kind) {
    case "new_game_invite":
      return `Someone added them to a new game. Write one short, fun sentence to get them to open the app and place themselves (e.g. a light tease or dare).`;
    case "mid_game_nudge":
      return `They haven't submitted yet; ${context.submittedCount} of ${context.totalCount} have. Write one short sentence to nudge them (don't name who submitted, just create FOMO or curiosity).`;
    case "results_reminder": {
      const names = context.otherPlayerNames?.length
        ? context.otherPlayerNames.join(", ")
        : "their friends";
      const nameHint = context.recipientDisplayName?.trim()
        ? ` Recipient is ${context.recipientDisplayName}; other players: ${names}.`
        : ` Other players: ${names}.`;
      return `The game has ended and they haven't viewed results yet.${nameHint} Write one short, personalized tease to get them to open the app (e.g. mention seeing where friends placed them, or who got it right—but do NOT reveal any actual placements or scores).`;
    }
    default:
      return `Write one short friendly sentence encouraging them to check the game.`;
  }
}

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

/** Default context for preview when not provided. */
export function defaultContext(overrides: Partial<GameContext> = {}): GameContext {
  return {
    axis_x_low: "Morning person",
    axis_x_high: "Night owl",
    axis_y_low: "Chaos",
    axis_y_high: "Order",
    submittedCount: 2,
    totalCount: 4,
    inviteCode: "ABC123",
    recipientDisplayName: "Sam",
    otherPlayerNames: ["Alex", "Jordan", "Casey"],
    ...overrides,
  };
}
