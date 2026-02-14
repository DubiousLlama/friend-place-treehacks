"use client";

import React, { useCallback, useRef } from "react";
import { motion, useMotionValue, type PanInfo } from "framer-motion";
import type { Position } from "@/lib/game-types";
import type { Anchor } from "@/lib/label-placement";
import type { GraphSizeConfig } from "@/lib/sizes";
import { DESKTOP_SIZES } from "@/lib/sizes";
import { pixelToNormalized, normalizedToPercent } from "@/lib/graph-utils";
import { springTransition, tapScale, hoverLift } from "@/lib/motion";

interface PlayerTokenProps {
  /** Unique identifier for layoutId animations */
  id: string;
  /** Display name or "YOU" */
  label: string;
  /** Self tokens are orange/larger; friend tokens are blue */
  variant: "self" | "friend";
  /** Normalized position on graph, or null if unplaced (in tray) */
  position: Position | null;
  /** Called when token is dropped on the graph */
  onPlace: (pos: Position) => void;
  /** Called when token is dragged off the graph (back to tray) */
  onRemove?: () => void;
  /** Ref to the graph's inner area for coordinate conversion */
  graphRef: React.RefObject<HTMLDivElement | null>;
  /** If true, token cannot be dragged */
  disabled?: boolean;
  /** Label anchor direction computed by collision avoidance (placed tokens only) */
  labelAnchor?: Anchor;
  /** Responsive size config — defaults to DESKTOP_SIZES */
  sizes?: GraphSizeConfig;
}

// ---------------------------------------------------------------------------
// Label offset styles keyed by anchor direction
// ---------------------------------------------------------------------------

function labelStyle(anchor: Anchor, hitSize: number, labelOffset: number): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  };
  const c = hitSize / 2;
  switch (anchor) {
    // --- right side ---
    case "ne":
      return { ...base, left: c + labelOffset, bottom: c };
    case "e":
      return { ...base, left: c + labelOffset, top: "50%", transform: "translateY(-50%)" };
    case "se":
      return { ...base, left: c + labelOffset, top: c };
    // --- centred horizontally ---
    case "n":
      return { ...base, left: "50%", transform: "translateX(-50%)", bottom: c + labelOffset };
    case "s":
      return { ...base, left: "50%", transform: "translateX(-50%)", top: c + labelOffset };
    // --- left side ---
    case "nw":
      return { ...base, right: c + labelOffset, bottom: c };
    case "sw":
      return { ...base, right: c + labelOffset, top: c };
    case "w":
      return { ...base, right: c + labelOffset, top: "50%", transform: "translateY(-50%)" };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlayerToken({
  id,
  label,
  variant,
  position,
  onPlace,
  onRemove,
  graphRef,
  disabled = false,
  labelAnchor = "ne",
  sizes = DESKTOP_SIZES,
}: PlayerTokenProps) {
  const tokenRef = useRef<HTMLDivElement>(null);

  const isSelf = variant === "self";
  const colorClass = isSelf ? "bg-splash" : "bg-accent";

  // Destructure pixel sizes from config
  const { dotSize, hitSize, labelOffset, labelFontSize, labelPadX, labelPadY, pillHeight, pillFontSize, pillPadX } = sizes;

  // --- Scale compensation ---
  const compensateX = useMotionValue(0);
  const compensateY = useMotionValue(0);
  const scaleRef = useRef(1);

  const handleDragStart = useCallback(() => {
    const graphEl = graphRef.current;
    if (graphEl) {
      scaleRef.current = graphEl.getBoundingClientRect().width / graphEl.offsetWidth;
    }
  }, [graphRef]);

  const handleDrag = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const s = scaleRef.current;
      if (s !== 1) {
        const factor = -(s - 1) / s;
        compensateX.set(info.offset.x * factor);
        compensateY.set(info.offset.y * factor);
      }
    },
    [compensateX, compensateY]
  );

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (disabled) return;

      const graphEl = graphRef.current;
      if (!graphEl) return;

      const graphRect = graphEl.getBoundingClientRect();
      const pointerX = info.point.x;
      const pointerY = info.point.y;

      const pad = Math.min(graphRect.width, graphRect.height) * 0.5;
      const nearGraph =
        pointerX >= graphRect.left - pad &&
        pointerX <= graphRect.right + pad &&
        pointerY >= graphRect.top - pad &&
        pointerY <= graphRect.bottom + pad;

      if (nearGraph) {
        const normalized = pixelToNormalized(pointerX, pointerY, graphRect);
        onPlace(normalized);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(10);
        }
      } else {
        onRemove?.();
      }
    },
    [disabled, graphRef, onPlace, onRemove]
  );

  // ---- Tray pill (unplaced) ----
  if (position === null) {
    return (
      <motion.div
        data-token="true"
        layoutId={`token-${id}`}
        style={{ zIndex: 20 }}
        className="relative"
      >
        <motion.div
          ref={tokenRef}
          drag={!disabled}
          dragMomentum={false}
          dragElastic={0}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          whileDrag={{
            scale: 1.08,
            boxShadow: isSelf
              ? "0 0 0 3px rgba(249,135,78,0.3), 0 6px 20px rgba(0,0,0,0.18)"
              : "0 0 0 3px rgba(98,126,248,0.3), 0 6px 20px rgba(0,0,0,0.18)",
            zIndex: 50,
          }}
          whileTap={disabled ? undefined : tapScale}
          whileHover={disabled ? undefined : { ...hoverLift, boxShadow: "0 4px 14px rgba(0,0,0,0.12)" }}
          transition={springTransition}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={`${isSelf ? "Your" : `${label}'s`} token — drag to place`}
          className={`
            flex items-center justify-center rounded-full
            font-body font-medium text-white select-none shadow-md
            ${colorClass}
            ${disabled ? "opacity-70 cursor-default" : "cursor-grab active:cursor-grabbing"}
          `}
          style={{
            height: pillHeight,
            paddingLeft: pillPadX,
            paddingRight: pillPadX,
            fontSize: pillFontSize,
            minHeight: pillHeight,
          }}
        >
          <span className="truncate leading-tight" style={{ maxWidth: 80 }}>
            {label}
          </span>
        </motion.div>
      </motion.div>
    );
  }

  // ---- Placed marker (dot + external label) ----
  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    ...normalizedToPercent(position),
    marginLeft: -hitSize / 2,
    marginTop: -hitSize / 2,
  };

  return (
    <motion.div
      data-token="true"
      style={{
        ...wrapperStyle,
        x: compensateX,
        y: compensateY,
        zIndex: 10,
      }}
    >
      <motion.div
        ref={tokenRef}
        drag={!disabled}
        dragMomentum={false}
        dragElastic={0}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        whileDrag={{
          boxShadow: isSelf
            ? "0 0 0 6px rgba(249,135,78,0.4), 0 4px 16px rgba(0,0,0,0.2)"
            : "0 0 0 6px rgba(98,126,248,0.4), 0 4px 16px rgba(0,0,0,0.2)",
          zIndex: 50,
        }}
        whileTap={disabled ? undefined : tapScale}
        transition={springTransition}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${isSelf ? "Your" : `${label}'s`} token — placed on graph`}
        className="cursor-default"
        style={{
          position: "relative",
          width: hitSize,
          height: hitSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
        }}
      >
        {/* Dot */}
        <div
          className={`rounded-full ${colorClass} shadow-sm`}
          style={{ width: dotSize, height: dotSize }}
        />

        {/* External label */}
        <span
          className="font-body font-medium text-foreground bg-white/80 rounded select-none leading-tight"
          style={{
            fontSize: labelFontSize,
            paddingLeft: labelPadX,
            paddingRight: labelPadX,
            paddingTop: labelPadY,
            paddingBottom: labelPadY,
            ...labelStyle(labelAnchor, hitSize, labelOffset),
          }}
        >
          {label}
        </span>
      </motion.div>
    </motion.div>
  );
}
