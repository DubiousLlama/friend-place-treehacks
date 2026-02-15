import type { Position } from "@/lib/game-types";
import type { PlacementSizes } from "@/lib/sizes";

/**
 * Cartographic label placement for point features.
 *
 * Based on Christensen, Marks & Shieber (1996) "A General Cartographic
 * Labelling Algorithm" and Imhof's (1962) positioning guidelines:
 *
 *  1. Generate 8 candidate positions per label (N, NE, E, SE, S, SW, W, NW).
 *  2. Score each using a weighted evaluation function:
 *       - LabelOver (label-label overlap): weight 40
 *       - PointPos  (Imhof preference):    weight 1
 *       - Out-of-bounds:                   weight 1000
 *  3. Greedy initialisation then iterative improvement (gradient descent):
 *     repeatedly try every anchor for each label, keeping the best, until
 *     stable or max iterations reached.
 */

export type Anchor = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export interface LabelInput {
  id: string;
  position: Position; // normalized 0–1
  labelWidth: number; // estimated width in normalized coords
  /** Per-label normalized height (overrides global labelH when provided) */
  labelH?: number;
  /** Per-label normalized offset from anchor point (overrides global offset) */
  offset?: number;
}

/** A circular obstacle that labels should try to avoid (e.g. a dot). */
export interface Obstacle {
  position: Position; // normalized 0–1
  radius: number;     // normalized radius
}

// ---------------------------------------------------------------------------
// Default constants (desktop-ish fallback when no PlacementSizes supplied)
// ---------------------------------------------------------------------------

const DEFAULT_LABEL_H = 0.055;
const DEFAULT_OFFSET = 0.03;
const DEFAULT_MARGIN = 0.008;

/**
 * Imhof position-preference values (lower = better).
 *   - Right of point preferred over left.
 *   - Above preferred over below.
 *   - Upper-right is optimal.
 * Values from Christensen et al. Figure 2.
 */
const PREF: Record<Anchor, number> = {
  ne: 0.0,
  e: 0.175,
  se: 0.4,
  n: 0.575,
  nw: 0.6,
  s: 0.8,
  sw: 0.875,
  w: 0.9,
};

/** Scoring weights (adapted from Christensen et al. Table 1) */
const W_OVERLAP = 40;
const W_DOT = 15;   // label-dot overlap (lower than label-label)
const W_POS = 1;
const W_OOB = 1000;

const ALL_ANCHORS: Anchor[] = ["ne", "e", "se", "n", "nw", "s", "sw", "w"];

// ---------------------------------------------------------------------------
// Rect helpers
// ---------------------------------------------------------------------------

type Rect = { x1: number; y1: number; x2: number; y2: number };

/**
 * Bounding rectangle for a label placed at `anchor` relative to a dot at
 * `pos`. Coordinates match the CSS rendering in PlayerToken.tsx exactly.
 *
 *   Normalized space: x 0→1 left→right, y 0→1 bottom→top.
 */
function labelRect(
  pos: Position,
  anchor: Anchor,
  labelW: number,
  labelH: number,
  offset: number,
): Rect {
  switch (anchor) {
    // --- right-side ---
    case "ne":
      return { x1: pos.x + offset, y1: pos.y, x2: pos.x + offset + labelW, y2: pos.y + labelH };
    case "e":
      return { x1: pos.x + offset, y1: pos.y - labelH / 2, x2: pos.x + offset + labelW, y2: pos.y + labelH / 2 };
    case "se":
      return { x1: pos.x + offset, y1: pos.y - labelH, x2: pos.x + offset + labelW, y2: pos.y };
    // --- centred horizontally ---
    case "n":
      return { x1: pos.x - labelW / 2, y1: pos.y + offset, x2: pos.x + labelW / 2, y2: pos.y + offset + labelH };
    case "s":
      return { x1: pos.x - labelW / 2, y1: pos.y - offset - labelH, x2: pos.x + labelW / 2, y2: pos.y - offset };
    // --- left-side ---
    case "nw":
      return { x1: pos.x - offset - labelW, y1: pos.y, x2: pos.x - offset, y2: pos.y + labelH };
    case "sw":
      return { x1: pos.x - offset - labelW, y1: pos.y - labelH, x2: pos.x - offset, y2: pos.y };
    case "w":
      return { x1: pos.x - offset - labelW, y1: pos.y - labelH / 2, x2: pos.x - offset, y2: pos.y + labelH / 2 };
  }
}

/** Check whether two rects overlap, including a margin buffer on all sides. */
function rectsOverlap(a: Rect, b: Rect, margin: number): boolean {
  return (
    a.x1 - margin < b.x2 + margin &&
    a.x2 + margin > b.x1 - margin &&
    a.y1 - margin < b.y2 + margin &&
    a.y2 + margin > b.y1 - margin
  );
}

/** Check whether a rect lies entirely within the 0–1 graph bounds. */
function isInBounds(r: Rect): boolean {
  return r.x1 >= 0 && r.y1 >= 0 && r.x2 <= 1 && r.y2 <= 1;
}

/** Check whether a rectangle overlaps a circle (obstacle). */
function rectOverlapsCircle(r: Rect, cx: number, cy: number, cr: number): boolean {
  // Find the closest point on the rect to the circle centre
  const closestX = Math.max(r.x1, Math.min(cx, r.x2));
  const closestY = Math.max(r.y1, Math.min(cy, r.y2));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < cr * cr;
}

// ---------------------------------------------------------------------------
// Main algorithm
// ---------------------------------------------------------------------------

/**
 * Compute optimal label anchor directions for a set of point labels.
 *
 * @param labels    - Array of labels with normalised positions and widths.
 * @param sizes     - Optional normalised sizes (from `toNormalizedSizes`).
 *                    Falls back to desktop-ish defaults when omitted.
 *                    Individual labels can override `labelH` and `offset`.
 * @param obstacles - Optional array of circular obstacles (e.g. dots) that
 *                    labels should try to avoid overlapping.
 *
 * Phase 1 — Greedy initialisation: process labels in order, for each pick the
 * anchor with the lowest cost considering already-placed labels.
 *
 * Phase 2 — Iterative improvement (gradient descent per Christensen et al.):
 * repeatedly cycle through all labels, for each try every anchor and keep the
 * one with the lowest total cost. Repeat until no changes or max iterations.
 */
export function computeLabelAnchors(
  labels: LabelInput[],
  sizes?: PlacementSizes,
  obstacles?: Obstacle[],
): Map<string, Anchor> {
  if (labels.length === 0) return new Map();

  const defaultLabelH = sizes?.labelH ?? DEFAULT_LABEL_H;
  const defaultOffset = sizes?.offset ?? DEFAULT_OFFSET;
  const margin = sizes?.margin ?? DEFAULT_MARGIN;
  const obs = obstacles ?? [];

  // Per-label rect: respects per-label overrides for height/offset
  const lRect = (idx: number, anchor: Anchor) => {
    const l = labels[idx];
    return labelRect(
      l.position,
      anchor,
      l.labelWidth,
      l.labelH ?? defaultLabelH,
      l.offset ?? defaultOffset,
    );
  };

  const overlap = (a: Rect, b: Rect) => rectsOverlap(a, b, margin);

  const dotCost = (rect: Rect) => {
    let c = 0;
    for (const o of obs) {
      if (rectOverlapsCircle(rect, o.position.x, o.position.y, o.radius)) {
        c += W_DOT;
      }
    }
    return c;
  };

  const cost = (idx: number, anchor: Anchor, assignment: Anchor[]) => {
    const rect = lRect(idx, anchor);
    let c = W_POS * PREF[anchor];
    if (!isInBounds(rect)) c += W_OOB;
    c += dotCost(rect);
    for (let j = 0; j < labels.length; j++) {
      if (j === idx) continue;
      if (overlap(rect, lRect(j, assignment[j]))) {
        c += W_OVERLAP;
      }
    }
    return c;
  };

  const n = labels.length;
  const assignment: Anchor[] = new Array(n);

  // --- Phase 1: greedy initialisation ---
  for (let i = 0; i < n; i++) {
    let bestAnchor: Anchor = "ne";
    let bestCost = Infinity;

    for (const a of ALL_ANCHORS) {
      const rect = lRect(i, a);
      let c = W_POS * PREF[a];
      if (!isInBounds(rect)) c += W_OOB;
      c += dotCost(rect);
      for (let j = 0; j < i; j++) {
        if (overlap(rect, lRect(j, assignment[j]))) {
          c += W_OVERLAP;
        }
      }
      if (c < bestCost) {
        bestCost = c;
        bestAnchor = a;
      }
    }

    assignment[i] = bestAnchor;
  }

  // --- Phase 2: iterative improvement ---
  let changed = true;
  let iter = 0;
  const MAX_ITER = 20;

  while (changed && iter < MAX_ITER) {
    changed = false;
    iter++;

    for (let i = 0; i < n; i++) {
      let bestAnchor = assignment[i];
      let bestCost = cost(i, assignment[i], assignment);

      for (const a of ALL_ANCHORS) {
        if (a === assignment[i]) continue;
        const c = cost(i, a, assignment);
        if (c < bestCost) {
          bestCost = c;
          bestAnchor = a;
          changed = true;
        }
      }

      assignment[i] = bestAnchor;
    }
  }

  // --- Build result map ---
  const result = new Map<string, Anchor>();
  for (let i = 0; i < n; i++) {
    result.set(labels[i].id, assignment[i]);
  }
  return result;
}
