"use client";

import React, { useRef, useMemo } from "react";
import { GameGraph } from "@/components/GameGraph";
import { PlayerToken } from "@/components/PlayerToken";
import { DESKTOP_SIZES, toNormalizedSizes } from "@/lib/sizes";
import { computeLabelAnchors } from "@/lib/label-placement";
import type { Position } from "@/lib/game-types";

const SAMPLE_SIZE = 280;

const SAMPLE_POSITIONS: { name: string; position: Position }[] = [
  { name: "Alex", position: { x: 0.22, y: 0.78 } },
  { name: "Bob", position: { x: 0.55, y: 0.45 } },
  { name: "Carol", position: { x: 0.8, y: 0.2 } },
];

interface SampleAxisPreviewProps {
  axisXLow: string;
  axisXHigh: string;
  axisYLow: string;
  axisYHigh: string;
}

/**
 * Read-only mini graph showing today's axes with example players Alex, Bob, Carol.
 * Used on the homepage hero to preview what a game looks like.
 * Uses same nametag styling as placing mode and results (via PlayerToken).
 */
export function SampleAxisPreview({
  axisXLow,
  axisXHigh,
  axisYLow,
  axisYHigh,
}: SampleAxisPreviewProps) {
  const graphRef = useRef<HTMLDivElement | null>(null);

  const placementSizes = useMemo(
    () => toNormalizedSizes(DESKTOP_SIZES, SAMPLE_SIZE, SAMPLE_SIZE),
    []
  );

  const labelAnchors = useMemo(() => {
    const { charWidth, padWidth } = placementSizes;
    const inputs = SAMPLE_POSITIONS.map(({ name, position }) => ({
      id: `sample-${name}`,
      position,
      labelWidth: name.length * charWidth + padWidth,
    }));
    return computeLabelAnchors(inputs, placementSizes);
  }, [placementSizes]);

  return (
    <div className="relative w-full max-w-[280px] aspect-square mx-auto overflow-hidden">
      <GameGraph
        axisXLow={axisXLow}
        axisXHigh={axisXHigh}
        axisYLow={axisYLow}
        axisYHigh={axisYHigh}
        graphRef={graphRef}
        sizes={DESKTOP_SIZES}
      >
        {SAMPLE_POSITIONS.map(({ name, position }, i) => (
          <PlayerToken
            key={name}
            id={`sample-${name}`}
            label={name}
            variant={i === 0 ? "self" : "friend"}
            position={position}
            onPlace={() => {}}
            graphRef={graphRef}
            disabled
            labelAnchor={labelAnchors.get(`sample-${name}`) ?? "ne"}
            sizes={DESKTOP_SIZES}
          />
        ))}
      </GameGraph>
      {/* Block all graph interactions (pan, zoom, drag) so only the parent button receives clicks */}
      <div
        className="absolute inset-0 z-10 cursor-pointer"
        aria-hidden
      />
    </div>
  );
}
