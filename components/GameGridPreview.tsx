"use client";

import React from "react";
import { normalizedToPercent } from "@/lib/graph-utils";
import type { Position } from "@/lib/game-types";

interface GameGridPreviewProps {
  axisXLow: string;
  axisXHigh: string;
  axisYLow: string;
  axisYHigh: string;
  /** Your own placement. Shown as splash (orange) dot. */
  selfPosition: Position | null;
  /** Your guesses for other players. Shown as accent (blue) dots. */
  otherPositions?: Position[];
  className?: string;
}

/**
 * Small non-interactive preview of the FriendPlace grid: axes, center cross,
 * quadrant tint, and placement dots (self + others).
 */
export function GameGridPreview({
  axisXLow,
  axisXHigh,
  axisYLow,
  axisYHigh,
  selfPosition,
  otherPositions = [],
  className = "",
}: GameGridPreviewProps) {
  const selfStyle = selfPosition
    ? { ...normalizedToPercent(selfPosition), transform: "translate(-50%, -50%)" as const }
    : null;

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-lg border border-secondary/10 bg-white ${className}`}
      role="img"
      aria-label={axisXLow || axisXHigh || axisYLow || axisYHigh ? `Grid: ${axisXLow} to ${axisXHigh} (horizontal), ${axisYLow} to ${axisYHigh} (vertical)` : "Blank grid"}
    >
      {/* Quadrant shading — same order as GameGraph */}
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
        <div className="bg-splash/3" />
        <div className="bg-accent/3" />
        <div className="bg-accent/3" />
        <div className="bg-splash/3" />
      </div>

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(circle, var(--color-secondary) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          backgroundPosition: "center center",
        }}
      />

      {/* Axis lines */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-secondary/30 -translate-x-1/2 pointer-events-none" />
      <div className="absolute top-1/2 left-0 right-0 h-px bg-secondary/30 -translate-y-1/2 pointer-events-none" />

      {/* Placements — z-0 so they stay behind labels */}
      {otherPositions.map((pos, i) => (
        <div
          key={i}
          className="absolute z-0 w-2 h-2 rounded-full bg-accent border border-white shadow-sm pointer-events-none"
          style={{ ...normalizedToPercent(pos), transform: "translate(-50%, -50%)" }}
        />
      ))}
      {selfStyle && (
        <div
          className="absolute z-0 w-2 h-2 rounded-full bg-splash border border-white shadow-sm pointer-events-none"
          style={selfStyle}
        />
      )}

      {/* Axis labels — z-10 with bg so they stay readable over dots */}
      {axisXLow !== "" && (
        <div className="absolute z-10 left-0.5 top-1/2 -translate-y-1/2 text-[8px] text-secondary truncate max-w-[35%] pointer-events-none px-0.5 py-px rounded bg-white/90 backdrop-blur-[2px]" title={axisXLow}>
          {axisXLow}
        </div>
      )}
      {axisXHigh !== "" && (
        <div className="absolute z-10 right-0.5 top-1/2 -translate-y-1/2 text-[8px] text-secondary truncate max-w-[35%] text-right pointer-events-none px-0.5 py-px rounded bg-white/90 backdrop-blur-[2px]" title={axisXHigh}>
          {axisXHigh}
        </div>
      )}
      {axisYLow !== "" && (
        <div className="absolute z-10 bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] text-secondary truncate max-w-[80%] text-center pointer-events-none px-0.5 py-px rounded bg-white/90 backdrop-blur-[2px]" title={axisYLow}>
          {axisYLow}
        </div>
      )}
      {axisYHigh !== "" && (
        <div className="absolute z-10 top-0.5 left-1/2 -translate-x-1/2 text-[8px] text-secondary truncate max-w-[80%] text-center pointer-events-none px-0.5 py-px rounded bg-white/90 backdrop-blur-[2px]" title={axisYHigh}>
          {axisYHigh}
        </div>
      )}
    </div>
  );
}
