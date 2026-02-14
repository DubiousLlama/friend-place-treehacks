"use client";

import React, { useCallback, useRef } from "react";
import { motion, useMotionValue, type PanInfo } from "framer-motion";
import type { Position } from "@/lib/game-types";
import type { Anchor } from "@/lib/label-placement";
import { pixelToNormalized, normalizedToPercent } from "@/lib/graph-utils";
import { springTransition, tapScale, hoverLift } from "@/lib/motion";

/** Size of the placement dot in px */
const DOT_SIZE = 12;
/** Size of the invisible hit area around the dot (must be > DOT_SIZE to prevent cursor oscillation) */
const HIT_SIZE = 28;
/** Size of tray pill height in px */
const PILL_H = 36;

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
}

// ---- Label offset styles keyed by anchor direction ----
const LABEL_OFFSET = 10; // px from dot edge

function labelStyle(anchor: Anchor): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  };
  const c = HIT_SIZE / 2;
  switch (anchor) {
    case "ne":
      return { ...base, left: c + LABEL_OFFSET, bottom: c };
    case "nw":
      return { ...base, right: c + LABEL_OFFSET, bottom: c };
    case "se":
      return { ...base, left: c + LABEL_OFFSET, top: c };
    case "sw":
      return { ...base, right: c + LABEL_OFFSET, top: c };
  }
}

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
}: PlayerTokenProps) {
  const tokenRef = useRef<HTMLDivElement>(null);

  const isSelf = variant === "self";
  const colorClass = isSelf ? "bg-splash" : "bg-accent";

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
        const normalized = pixelToNormalized(pointerX, pointerY, graphRect, DOT_SIZE / 2);
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
            height: PILL_H,
            paddingLeft: 14,
            paddingRight: 14,
            fontSize: 12,
            minHeight: PILL_H,
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
    marginLeft: -HIT_SIZE / 2,
    marginTop: -HIT_SIZE / 2,
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
      {/* Layer 2: inverse scale — keeps marker constant screen size */}
      <div
        style={{
          transform: "scale(calc(1 / var(--graph-scale, 1)))",
          transformOrigin: "center",
        }}
      >
        {/* Layer 3: drag behavior + visual content */}
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
            width: HIT_SIZE,
            height: HIT_SIZE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
          }}
        >
          {/* Dot */}
          <div
            className={`rounded-full ${colorClass} shadow-sm`}
            style={{ width: DOT_SIZE, height: DOT_SIZE }}
          />

          {/* External label */}
          <span
            className="font-body text-[13px] font-medium text-foreground bg-white/80 rounded px-1.5 py-0.5 select-none leading-tight"
            style={labelStyle(labelAnchor)}
          >
            {label}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
