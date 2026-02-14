import type { Position } from "@/lib/game-types";

export type Anchor = "ne" | "nw" | "se" | "sw";

interface LabelInput {
  id: string;
  position: Position; // normalized 0-1
  labelWidth: number; // estimated in normalized coords (e.g. charCount * 0.02)
}

/** Estimated label height in normalized coords */
const LABEL_H = 0.04;
/** Offset from dot center to label edge in normalized coords */
const OFFSET = 0.03;

/**
 * Compute a bounding box for a label placed at the given anchor direction
 * relative to a dot at `pos`. All values in normalized 0-1 space.
 */
function candidateRect(
  pos: Position,
  anchor: Anchor,
  labelW: number
): { x1: number; y1: number; x2: number; y2: number } {
  switch (anchor) {
    case "ne":
      return {
        x1: pos.x + OFFSET,
        y1: pos.y + OFFSET,
        x2: pos.x + OFFSET + labelW,
        y2: pos.y + OFFSET + LABEL_H,
      };
    case "nw":
      return {
        x1: pos.x - OFFSET - labelW,
        y1: pos.y + OFFSET,
        x2: pos.x - OFFSET,
        y2: pos.y + OFFSET + LABEL_H,
      };
    case "se":
      return {
        x1: pos.x + OFFSET,
        y1: pos.y - OFFSET - LABEL_H,
        x2: pos.x + OFFSET + labelW,
        y2: pos.y - OFFSET,
      };
    case "sw":
      return {
        x1: pos.x - OFFSET - labelW,
        y1: pos.y - OFFSET - LABEL_H,
        x2: pos.x - OFFSET,
        y2: pos.y - OFFSET,
      };
  }
}

/** Check whether two axis-aligned rectangles overlap */
function rectsOverlap(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

/** Check whether a rect is fully within the 0-1 graph bounds */
function isInBounds(r: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return r.x1 >= 0 && r.y1 >= 0 && r.x2 <= 1 && r.y2 <= 1;
}

const ANCHORS: Anchor[] = ["ne", "nw", "se", "sw"];

/**
 * Greedy cartographic label placement for a small number of point labels.
 *
 * For each label, tries 4 anchor positions (NE, NW, SE, SW) and picks the
 * one with the best score: preferring in-bounds, non-overlapping placements,
 * with a slight bias toward the "natural" quadrant (NE for right-half points,
 * NW for left-half points).
 *
 * Labels are processed center-out so edge labels can adapt to center ones.
 */
export function computeLabelAnchors(labels: LabelInput[]): Map<string, Anchor> {
  if (labels.length === 0) return new Map();

  // Sort center-out: labels closest to (0.5, 0.5) first
  const sorted = [...labels].sort((a, b) => {
    const distA = Math.hypot(a.position.x - 0.5, a.position.y - 0.5);
    const distB = Math.hypot(b.position.x - 0.5, b.position.y - 0.5);
    return distA - distB;
  });

  const result = new Map<string, Anchor>();
  const placedRects: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (const label of sorted) {
    let bestAnchor: Anchor = "ne";
    let bestScore = -Infinity;

    for (const anchor of ANCHORS) {
      const rect = candidateRect(label.position, anchor, label.labelWidth);
      let score = 0;

      // Prefer in-bounds
      if (isInBounds(rect)) {
        score += 10;
      }

      // Penalise overlaps with already-placed labels
      for (const placed of placedRects) {
        if (rectsOverlap(rect, placed)) {
          score -= 20;
        }
      }

      // Slight bias toward "natural" direction
      if (label.position.x >= 0.5 && (anchor === "nw" || anchor === "sw")) {
        score += 2;
      } else if (label.position.x < 0.5 && (anchor === "ne" || anchor === "se")) {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAnchor = anchor;
      }
    }

    result.set(label.id, bestAnchor);
    placedRects.push(candidateRect(label.position, bestAnchor, label.labelWidth));
  }

  return result;
}
