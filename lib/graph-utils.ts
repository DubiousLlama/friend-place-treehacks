import type { Position } from "@/lib/game-types";

/**
 * Convert a pixel position (e.g. from a pointer event) to normalized 0-1
 * coordinates within the graph area.
 *
 * `graphRect` must come from `getBoundingClientRect()` on the transformed
 * element — the browser already accounts for CSS transforms (pan/zoom)
 * in the returned rect, so no additional scale/pan math is needed.
 *
 * Y is inverted so that 0 = bottom, 1 = top (matching typical graph convention).
 *
 * `insetPx` (optional, default 0) — pixel inset from each edge. When set,
 * the returned position is clamped so that a circle of this radius stays
 * fully inside the graph. Pass `DOT_SIZE / 2` to keep dots visible.
 */
export function pixelToNormalized(
  pixelX: number,
  pixelY: number,
  graphRect: DOMRect,
  insetPx = 0
): Position {
  const relX = (pixelX - graphRect.left) / graphRect.width;
  const relY = (pixelY - graphRect.top) / graphRect.height;

  // Compute normalized inset so the dot center stays far enough from the edge
  const insetX = graphRect.width > 0 ? insetPx / graphRect.width : 0;
  const insetY = graphRect.height > 0 ? insetPx / graphRect.height : 0;

  return {
    x: Math.max(insetX, Math.min(1 - insetX, relX)),
    y: Math.max(insetY, Math.min(1 - insetY, 1 - relY)),
  };
}

/**
 * Convert normalized 0-1 coordinates to CSS percentage values for absolute
 * positioning within the graph container.
 *
 * The returned `top` inverts Y back so it works with CSS (0% = top of div).
 */
export function normalizedToPercent(pos: Position): {
  left: string;
  top: string;
} {
  return {
    left: `${pos.x * 100}%`,
    top: `${(1 - pos.y) * 100}%`, // invert Y back for CSS
  };
}

/**
 * Check whether a pixel position falls within the graph area rectangle.
 */
export function isWithinGraph(
  pixelX: number,
  pixelY: number,
  graphRect: DOMRect
): boolean {
  return (
    pixelX >= graphRect.left &&
    pixelX <= graphRect.right &&
    pixelY >= graphRect.top &&
    pixelY <= graphRect.bottom
  );
}
