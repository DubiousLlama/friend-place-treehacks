import { getSeasonalContext } from "./context";

/** Shape the LLM must return for axis suggestions */
export interface AxisSuggestion {
  x_low: string;
  x_high: string;
  y_low: string;
  y_high: string;
}

// ────────────────────────────────────────────────────────────
// System prompt (shared across daily + regenerate)
// ────────────────────────────────────────────────────────────

export const AXIS_SYSTEM_PROMPT = `You suggest axis labels for a 2D chart game. Rules:

- Output two axes. Each axis is a pair of words from the same category (so the two words are similar in kind).
- Pick two random categories (e.g. fantasy characters, breakfast foods, coffee brands, seasons). One category per axis.
- Each label is exactly one word or one proper noun. No phrases.
- Order: horizontal axis (low, high), then vertical axis (low, high).`;


// ────────────────────────────────────────────────────────────
// User prompts
// ────────────────────────────────────────────────────────────

/** Prompt for the daily axis (generated once per day, seen by everyone) */
export function buildDailyAxisPrompt(recentDailyAxes?: string[]): string {
  const ctx = getSeasonalContext();
  const avoidBlock =
    recentDailyAxes && recentDailyAxes.length > 0
      ? `\nRecent daily axes (avoid repeating these):\n${recentDailyAxes.join("\n")}\n`
      : "";
  return `${ctx.note}
${avoidBlock}
Generate two axis pairs. Each pair is two words from the same category. Two categories total, one per axis.

Reply with exactly 4 lines: horizontal low, horizontal high, vertical low, vertical high. One word per line. No other text.`;
}

/** Current axes context for avoid/similarity */
export interface RegenerateAxisOptions {
  /** The axis we're NOT regenerating — include so the new pair is thematically distinct */
  otherAxis: { low: string; high: string };
  dailyAxes?: AxisSuggestion | null;
  /** Previous suggestion for THIS axis only (so we don't repeat) */
  previousPair?: { low: string; high: string } | null;
  /** Axis pairs from the user's past games (e.g. ["Gimli ↔ Legolas | Muffin ↔ Pancake"]) — avoid repeating */
  pastGameAxes?: string[];
  /** Group interests; use for inspiration but same interest not on both axes */
  groupInterests?: string[];
}

/** Prompt for regenerating one axis; includes the other axis and optional past games so similar things aren't generated */
export function buildRegenerateOneAxisPrompt(
  axis: "horizontal" | "vertical",
  options: RegenerateAxisOptions,
): string {
  const ctx = getSeasonalContext();
  const { otherAxis, dailyAxes, previousPair, pastGameAxes, groupInterests } = options;

  const otherLabel = axis === "horizontal" ? "Vertical" : "Horizontal";
  const avoidList: string[] = [
    `The ${otherLabel.toLowerCase()} axis is already set to "${otherAxis.low}" ↔ "${otherAxis.high}". Generate a ${axis} pair that is thematically distinct — don't repeat similar ideas or vibe.`,
  ];
  if (dailyAxes) {
    const dailyPair =
      axis === "horizontal"
        ? `"${dailyAxes.x_low}" ↔ "${dailyAxes.x_high}"`
        : `"${dailyAxes.y_low}" ↔ "${dailyAxes.y_high}"`;
    avoidList.push(`Daily ${axis} pair (avoid repeating): ${dailyPair}`);
  }
  if (previousPair) {
    avoidList.push(`Previous ${axis} pair (avoid repeating): "${previousPair.low}" ↔ "${previousPair.high}"`);
  }
  if (pastGameAxes && pastGameAxes.length > 0) {
    avoidList.push(`Past games used these axes (vary from these):\n${pastGameAxes.join("\n")}`);
  }
  if (groupInterests && groupInterests.length > 0) {
    avoidList.push(
      `Group interests (use for inspiration; do not use the same interest on both axes — the other axis already used some): ${groupInterests.join(", ")}. Prefer that this axis use at most one or two of these interests, and not the same idea as the other axis.`,
    );
  }

  return `${ctx.note}

${avoidList.join("\n")}

Generate one new axis: two words from the same category (different from the axes above).

Reply with exactly 2 lines: ${axis} low, then ${axis} high. One word per line. No other text.`;
}

/** Options for group-initial axes (both axes at once, informed by interests) */
export interface GroupAxesOptions {
  /** Group interests; each should inspire at most one axis (so same interest not on both axes). */
  groupInterests: string[];
}

/**
 * Prompt for generating both axes when creating a game with a group that has interests.
 * Constraint: use interests as inspiration but each interest only on one axis (so the same interest does not appear on both axes).
 */
export function buildGroupAxesPrompt(options: GroupAxesOptions): string {
  const ctx = getSeasonalContext();
  const { groupInterests } = options;
  const list = groupInterests.slice(0, 12).join(", "); // cap so prompt stays small
  return `${ctx.note}

This game is for a group with these interests: ${list}.

Generate two axis pairs that are relevant to these interests. Rules:
- Use the interests as inspiration; axis labels can be related to or contrast with them.
- Each interest should only appear on one axis (do not put the same interest on both axes). Use at most two interests per axis.
- Each axis is a pair of words from the same category. One word or one proper noun per label. No phrases.

Reply with exactly 4 lines: horizontal low, horizontal high, vertical low, vertical high. One word per line. No other text.`;
}
