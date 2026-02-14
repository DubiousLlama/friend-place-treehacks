"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useGesture } from "@use-gesture/react";
import { motion, AnimatePresence } from "framer-motion";

export interface TransformState {
  scale: number;
  panX: number;
  panY: number;
}

interface GameGraphProps {
  axisXLow: string;
  axisXHigh: string;
  axisYLow: string;
  axisYHigh: string;
  children: React.ReactNode;
  /** Ref forwarded to the inner graph area for coordinate math */
  graphRef: React.RefObject<HTMLDivElement | null>;
  /** Exposes current transform state for coordinate conversion */
  onTransformChange?: (t: TransformState) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 3;

/**
 * Clamp pan values so the scaled graph content always fills the outer
 * container — no white space is ever exposed at the edges.
 */
function clampPan(
  panX: number,
  panY: number,
  scale: number,
  containerW: number,
  containerH: number
): { panX: number; panY: number } {
  const maxPanX = (containerW * (scale - 1)) / 2;
  const maxPanY = (containerH * (scale - 1)) / 2;
  return {
    panX: Math.max(-maxPanX, Math.min(maxPanX, panX)),
    panY: Math.max(-maxPanY, Math.min(maxPanY, panY)),
  };
}

// ---------------------------------------------------------------------------
// AxisLabel — interactive label with hover / long-press tooltip
// ---------------------------------------------------------------------------

interface AxisLabelProps {
  text: string;
  /** Which edge of the graph the label is on */
  edge: "top" | "bottom" | "left" | "right";
}

function AxisLabel({ text, edge }: AxisLabelProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Desktop hover
  const handleMouseEnter = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setShowTooltip(true), 300);
  }, [clearTimer]);

  const handleMouseLeave = useCallback(() => {
    clearTimer();
    setShowTooltip(false);
  }, [clearTimer]);

  // Mobile long-press
  const handlePointerDown = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setShowTooltip(true), 500);
  }, [clearTimer]);

  const handlePointerUp = useCallback(() => {
    clearTimer();
    setShowTooltip(false);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const isVertical = edge === "left" || edge === "right";

  // Tooltip position: toward graph interior
  const tooltipPosition: React.CSSProperties = (() => {
    switch (edge) {
      case "left":
        return { left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: 6 };
      case "right":
        return { right: "100%", top: "50%", transform: "translateY(-50%)", marginRight: 6 };
      case "top":
        return { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 4 };
      case "bottom":
        return { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 4 };
    }
  })();

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden cursor-default"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <span
        className={`
          font-display text-[10px] font-semibold text-secondary select-none truncate
          ${isVertical ? "max-h-full" : "max-w-full"}
        `}
        style={
          isVertical
            ? {
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                transform: edge === "left" ? "rotate(180deg)" : undefined,
              }
            : undefined
        }
      >
        {text}
      </span>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bg-white rounded-lg shadow-lg px-3 py-1.5 font-body text-sm text-foreground whitespace-nowrap pointer-events-none"
            style={tooltipPosition}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GameGraph
// ---------------------------------------------------------------------------

export function GameGraph({
  axisXLow,
  axisXHigh,
  axisYLow,
  axisYHigh,
  children,
  graphRef,
  onTransformChange,
}: GameGraphProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const isDraggingTokenRef = useRef(false);
  const [transform, setTransform] = useState<TransformState>({
    scale: 1,
    panX: 0,
    panY: 0,
  });

  // Keep parent informed of transform changes
  useEffect(() => {
    onTransformChange?.(transform);
  }, [transform, onTransformChange]);

  /** Get the outer container's dimensions for pan clamping */
  const getContainerSize = useCallback(() => {
    const el = outerRef.current;
    if (!el) return { w: 0, h: 0 };
    return { w: el.clientWidth, h: el.clientHeight };
  }, []);

  // Gesture handling for pan and pinch-zoom
  useGesture(
    {
      onDrag: ({ first, last, delta: [dx, dy], event }) => {
        if (first) {
          isDraggingTokenRef.current = !!(event?.target as HTMLElement)?.closest("[data-token]");
        }
        if (isDraggingTokenRef.current) {
          if (last) isDraggingTokenRef.current = false;
          return;
        }
        const { w, h } = getContainerSize();
        setTransform((t) => {
          const clamped = clampPan(t.panX + dx, t.panY + dy, t.scale, w, h);
          return { ...t, ...clamped };
        });
        if (last) isDraggingTokenRef.current = false;
      },
      onPinch: ({ offset: [scale] }) => {
        const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
        const { w, h } = getContainerSize();
        setTransform((t) => {
          const clamped = clampPan(t.panX, t.panY, clampedScale, w, h);
          return { ...t, scale: clampedScale, ...clamped };
        });
      },
      onWheel: ({ delta: [, dy] }) => {
        const { w, h } = getContainerSize();
        setTransform((t) => {
          const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale - dy * 0.002));
          const clamped = clampPan(t.panX, t.panY, nextScale, w, h);
          return { scale: nextScale, ...clamped };
        });
      },
    },
    {
      target: outerRef,
      drag: { filterTaps: true },
      pinch: { scaleBounds: { min: MIN_SCALE, max: MAX_SCALE } },
    }
  );

  // Reset zoom on double-tap
  const handleDoubleClick = useCallback(() => {
    setTransform({ scale: 1, panX: 0, panY: 0 });
    onTransformChange?.({ scale: 1, panX: 0, panY: 0 });
  }, [onTransformChange]);

  return (
    <div
      className="w-full max-w-[min(90vw,500px)] mx-auto"
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr 24px",
        gridTemplateRows: "20px 1fr 20px",
        gap: 2,
      }}
      role="img"
      aria-label={`Graph with axes: ${axisXLow} to ${axisXHigh} (horizontal), ${axisYLow} to ${axisYHigh} (vertical)`}
    >
      {/* Y-axis high label (top) */}
      <div className="col-start-2 row-start-1 flex items-end justify-center px-1">
        <AxisLabel text={axisYHigh} edge="top" />
      </div>

      {/* X-axis low label (left) */}
      <div className="col-start-1 row-start-2 flex items-center justify-center py-1">
        <AxisLabel text={axisXLow} edge="left" />
      </div>

      {/* Graph viewport (center) */}
      <div
        ref={outerRef}
        className="col-start-2 row-start-2 relative aspect-square overflow-hidden rounded-2xl bg-white border border-secondary/10 shadow-sm"
        style={{ touchAction: "none" }}
        onDoubleClick={handleDoubleClick}
      >
        {/* Transform layer — pan/zoom applied here, everything moves together */}
        <div
          ref={graphRef}
          className="absolute inset-0 origin-center"
          style={{
            transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.scale})`,
            willChange: "transform",
            "--graph-scale": String(transform.scale),
          } as React.CSSProperties}
        >
          {/* Quadrant shading */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
            <div className="bg-splash/3" />
            <div className="bg-accent/3" />
            <div className="bg-accent/3" />
            <div className="bg-splash/3" />
          </div>

          {/* Subtle dot grid pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.08]"
            style={{
              backgroundImage: "radial-gradient(circle, #66666e 0.5px, transparent 0.5px)",
              backgroundSize: "20px 20px",
            }}
          />

          {/* Axis lines */}
          <motion.div
            className="absolute left-1/2 top-0 bottom-0 w-px bg-secondary/30 -translate-x-1/2 pointer-events-none"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          />
          <motion.div
            className="absolute top-1/2 left-0 right-0 h-px bg-secondary/30 -translate-y-1/2 pointer-events-none"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
          />

          {/* Token children rendered here — absolutely positioned */}
          {children}
        </div>
      </div>

      {/* X-axis high label (right) */}
      <div className="col-start-3 row-start-2 flex items-center justify-center py-1">
        <AxisLabel text={axisXHigh} edge="right" />
      </div>

      {/* Y-axis low label (bottom) */}
      <div className="col-start-2 row-start-3 flex items-start justify-center px-1">
        <AxisLabel text={axisYLow} edge="bottom" />
      </div>
    </div>
  );
}
