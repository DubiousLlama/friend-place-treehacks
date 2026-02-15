/**
 * Player colour assignment for the results screen.
 *
 * Each player gets a unique, visually distinct colour from a curated palette.
 * Falls back to HSL generation for games with more than 8 players.
 */

// ---------------------------------------------------------------------------
// Curated palette — 8 high-contrast colours that work on white backgrounds
// ---------------------------------------------------------------------------

const PLAYER_COLORS = [
  "#E8583A", // tomato red   (distinct from splash #F9874E)
  "#3B82F6", // sky blue     (distinct from accent #627EF8)
  "#22C55E", // green
  "#A855F7", // purple
  "#F43F5E", // rose
  "#06B6D4", // cyan
  "#EAB308", // amber
  "#EC4899", // pink
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a hex colour (#RRGGBB) to an "r, g, b" channel string for use
 * in rgba() functions.
 */
function hexToChannels(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/**
 * Generate a colour using evenly-spaced hue values for games with 9+ players.
 */
function hslColor(index: number, total: number): string {
  const hue = (index * 360) / total;
  return `hsl(${Math.round(hue)}, 70%, 55%)`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PlayerColorInfo {
  /** Full-opacity hex colour for this player. */
  color: string;
  /** rgba() string at 20% opacity — for dimmed / background states. */
  dimmed: string;
  /** rgba() string at 50% opacity — for medium emphasis. */
  medium: string;
}

/**
 * Assign a colour to each player based on their index.
 *
 * @param playerIds - Array of game_player IDs in display order (sorted by claimed_at).
 * @returns Map from game_player ID to { color, dimmed, medium }.
 */
export function assignPlayerColors(
  playerIds: string[],
): Map<string, PlayerColorInfo> {
  const result = new Map<string, PlayerColorInfo>();

  for (let i = 0; i < playerIds.length; i++) {
    let color: string;
    if (i < PLAYER_COLORS.length) {
      color = PLAYER_COLORS[i];
    } else {
      color = hslColor(i, playerIds.length);
    }

    const channels = i < PLAYER_COLORS.length ? hexToChannels(color) : null;
    const dimmed = channels
      ? `rgba(${channels}, 0.2)`
      : color.replace("55%)", "55%, 0.2)").replace("hsl(", "hsla(");
    const medium = channels
      ? `rgba(${channels}, 0.5)`
      : color.replace("55%)", "55%, 0.5)").replace("hsl(", "hsla(");

    result.set(playerIds[i], { color, dimmed, medium });
  }

  return result;
}

/**
 * Get a single player's colour by index (convenience for inline use).
 */
export function getPlayerColor(index: number, total: number): string {
  if (index < PLAYER_COLORS.length) return PLAYER_COLORS[index];
  return hslColor(index, total);
}
