/**
 * Centralised colour palette & shadow helpers.
 *
 * Every colour used across components should come from this file (for JS) or
 * from the matching CSS custom-properties in globals.css (for Tailwind / CSS).
 *
 * KEEP IN SYNC with the :root variables in app/globals.css.
 */

// ---------------------------------------------------------------------------
// Core palette
// ---------------------------------------------------------------------------

export const theme = {
  background: "#ffffff",
  foreground: "#171717",
  surface: "#f4f4f6",
  /** Slightly darker surface – used for inactive pills, dividers, etc. */
  surfaceMuted: "#e5e5e7",
  secondary: "#66666e",
  black: "#000000",
  white: "#ffffff",
  splash: "#F9874E",
  accent: "#627EF8",
} as const;

// ---------------------------------------------------------------------------
// Derived RGBA helpers
// ---------------------------------------------------------------------------

/** Convert a hex colour (#RRGGBB or #RGB) to "r, g, b" channel string. */
function hexToRgbChannels(hex: string): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
      : h;
  return `${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)}`;
}

/** Build an rgba(...) colour string from a hex colour + alpha (0–1). */
export function rgba(hex: string, alpha: number): string {
  return `rgba(${hexToRgbChannels(hex)}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Pre-built shadow strings (for Framer-Motion whileDrag / whileHover etc.)
// Framer Motion needs raw colour values it can parse – CSS var() won't work
// inside animated properties.
// ---------------------------------------------------------------------------

/** Ring + drop-shadow shown while dragging a tray pill. */
export function dragShadowTray(variant: "self" | "friend"): string {
  const ring = variant === "self" ? theme.splash : theme.accent;
  return `0 0 0 3px ${rgba(ring, 0.3)}, 0 6px 20px ${rgba(theme.black, 0.18)}`;
}

/** Ring + drop-shadow shown while dragging a placed dot. */
export function dragShadowPlaced(variant: "self" | "friend"): string {
  const ring = variant === "self" ? theme.splash : theme.accent;
  return `0 0 0 6px ${rgba(ring, 0.4)}, 0 4px 16px ${rgba(theme.black, 0.2)}`;
}

/** Subtle lift shadow on hover. */
export const hoverShadow = `0 4px 14px ${rgba(theme.black, 0.12)}`;

/** Upward tray shadow (TokenTray). */
export const trayShadow = `0 -2px 8px ${rgba(theme.black, 0.04)}`;
