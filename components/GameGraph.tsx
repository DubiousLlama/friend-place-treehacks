"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useGesture } from "@use-gesture/react";
import { motion, AnimatePresence } from "framer-motion";
import type { GraphSizeConfig } from "@/lib/sizes";
import { DESKTOP_SIZES } from "@/lib/sizes";

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
  /** Responsive size config — defaults to DESKTOP_SIZES */
  sizes?: GraphSizeConfig;
}

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const GRID_GAP = 2;
const AUTO_SCROLL_ZONE = 40;   // px from viewport edge that triggers scrolling
const AUTO_SCROLL_SPEED = 5;   // max px per animation frame

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Compute the viewport dimensions for a given zoom scale.
 * At scale=1 the viewport is a square of `baseSize`.
 * As scale increases the viewport smoothly grows toward available space.
 */
function computeViewport(
  scale: number,
  baseSize: number,
  maxVpW: number,
  maxVpH: number,
): { w: number; h: number } {
  const progress = Math.min(1, Math.max(0, (scale - 1) / (MAX_SCALE - 1)));
  return {
    w: lerp(baseSize, Math.min(maxVpW, baseSize * scale), progress),
    h: lerp(baseSize, Math.min(maxVpH, baseSize * scale), progress),
  };
}

/**
 * Pure function that computes all layout values from the current zoom scale
 * and available space. Called both during render and inside gesture handlers.
 */
function computeLayout(
  scale: number,
  availW: number,
  availH: number,
  axisLabelTrack: number,
) {
  const progress = Math.min(1, Math.max(0, (scale - 1) / (MAX_SCALE - 1)));

  // Label tracks + gap shrink to 0 as zoom increases so the graph can
  // truly extend to the screen edge.
  const fullTrackH = axisLabelTrack;
  const fullTrackV = Math.max(0, axisLabelTrack - 4);
  const effectiveTrackH = lerp(fullTrackH, 0, progress);
  const effectiveTrackV = lerp(fullTrackV, 0, progress);
  const effectiveGap = lerp(GRID_GAP, 0, progress);

  // Max viewport with effective (shrinking) label tracks
  const maxVpW = Math.max(0, availW - 2 * effectiveTrackH - 2 * effectiveGap);
  const maxVpH = Math.max(0, availH - 2 * effectiveTrackV - 2 * effectiveGap);

  // Base square size at zoom=1 (uses full label tracks — never changes with zoom)
  const baseGridW = Math.min(availW, 500);
  const baseVpFromW = baseGridW - 2 * fullTrackH - 2 * GRID_GAP;
  const baseMaxVpH = Math.max(0, availH - 2 * fullTrackV - 2 * GRID_GAP);
  const baseSize = Math.max(0, Math.min(baseVpFromW, baseMaxVpH));

  // Dynamic viewport — grows toward available space as zoom increases
  const vp = computeViewport(scale, baseSize, maxVpW, maxVpH);

  return {
    baseSize,
    viewportW: vp.w,
    viewportH: vp.h,
    effectiveTrackH,
    effectiveTrackV,
    effectiveGap,
    progress,
  };
}

/**
 * Clamp pan so the scaled square graph always covers the viewport —
 * no background is ever exposed at the edges.
 */
function clampPan(
  panX: number,
  panY: number,
  scale: number,
  graphSize: number,
  viewportW: number,
  viewportH: number,
): { panX: number; panY: number } {
  const scaledGraph = graphSize * scale;
  const maxPanX = Math.max(0, (scaledGraph - viewportW) / 2);
  const maxPanY = Math.max(0, (scaledGraph - viewportH) / 2);
  return {
    panX: Math.max(-maxPanX, Math.min(maxPanX, panX)),
    panY: Math.max(-maxPanY, Math.min(maxPanY, panY)),
  };
}

/**
 * Compute auto-scroll velocity based on pointer proximity to viewport edges.
 * Returns {x, y} in px/frame. Positive x → pan right; positive y → pan down.
 * Only non-zero when pointer is within AUTO_SCROLL_ZONE of an edge.
 */
function computeAutoScrollVel(
  px: number,
  py: number,
  rect: DOMRect,
): { x: number; y: number } {
  const distL = px - rect.left;
  const distR = rect.right - px;
  const distT = py - rect.top;
  const distB = rect.bottom - py;

  // Ignore if pointer is far outside the viewport
  if (
    distL < -AUTO_SCROLL_ZONE || distR < -AUTO_SCROLL_ZONE ||
    distT < -AUTO_SCROLL_ZONE || distB < -AUTO_SCROLL_ZONE
  ) {
    return { x: 0, y: 0 };
  }

  let vx = 0;
  let vy = 0;

  if (distL < AUTO_SCROLL_ZONE) {
    vx = AUTO_SCROLL_SPEED * Math.min(1, Math.max(0, 1 - distL / AUTO_SCROLL_ZONE));
  } else if (distR < AUTO_SCROLL_ZONE) {
    vx = -AUTO_SCROLL_SPEED * Math.min(1, Math.max(0, 1 - distR / AUTO_SCROLL_ZONE));
  }

  if (distT < AUTO_SCROLL_ZONE) {
    vy = AUTO_SCROLL_SPEED * Math.min(1, Math.max(0, 1 - distT / AUTO_SCROLL_ZONE));
  } else if (distB < AUTO_SCROLL_ZONE) {
    vy = -AUTO_SCROLL_SPEED * Math.min(1, Math.max(0, 1 - distB / AUTO_SCROLL_ZONE));
  }

  return { x: vx, y: vy };
}

// ---------------------------------------------------------------------------
// AxisLabel — interactive label with hover / tap tooltip
// ---------------------------------------------------------------------------

interface AxisLabelProps {
  text: string;
  /** Which edge of the graph the label is on */
  edge: "top" | "bottom" | "left" | "right";
  /** Axis label font size (px) */
  fontSize: number;
  /** Tooltip font size (px) */
  tooltipFontSize: number;
  /** If true, uses semi-transparent overlay styling (for zoomed-in labels) */
  overlay?: boolean;
}

function AxisLabel({ text, edge, fontSize, tooltipFontSize, overlay = false }: AxisLabelProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const forwardedRef = useRef(false);

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

  // Tap to toggle (mobile-friendly — replaces long-press)
  const handleClick = useCallback(() => {
    // Skip if we just forwarded the pointer event to a token
    if (forwardedRef.current) {
      forwardedRef.current = false;
      return;
    }
    setShowTooltip((prev) => !prev);
  }, []);

  // In overlay mode, give tokens underneath click/drag priority.
  // Temporarily hide pointer-events, peek underneath, and forward if a token is there.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!overlay) return;
      const container = containerRef.current;
      if (!container) return;

      // Hide ourselves to see what's underneath
      container.style.pointerEvents = "none";
      const underneath = document.elementFromPoint(e.clientX, e.clientY);

      if (underneath?.closest("[data-token]")) {
        // Token found — keep label hidden for the duration of this gesture
        forwardedRef.current = true;
        e.stopPropagation();

        // Forward the pointerdown to the element underneath
        underneath.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
            pointerId: e.nativeEvent.pointerId,
            pointerType: e.nativeEvent.pointerType,
            isPrimary: e.nativeEvent.isPrimary,
            button: e.nativeEvent.button,
            buttons: e.nativeEvent.buttons,
          }),
        );

        // Restore pointer-events when the gesture finishes
        const restore = () => {
          container.style.pointerEvents = "";
          document.removeEventListener("pointerup", restore);
          document.removeEventListener("pointercancel", restore);
        };
        document.addEventListener("pointerup", restore, { once: true });
        document.addEventListener("pointercancel", restore, { once: true });
        return;
      }

      // No token — restore and let normal tooltip handling proceed
      container.style.pointerEvents = "";
    },
    [overlay],
  );

  // Dismiss on outside tap & auto-dismiss after 3 s
  useEffect(() => {
    if (!showTooltip) return;
    const handleOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    const autoTimer = setTimeout(() => setShowTooltip(false), 3000);
    document.addEventListener("pointerdown", handleOutside);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      clearTimeout(autoTimer);
    };
  }, [showTooltip]);

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
      ref={containerRef}
      className={`relative flex items-center justify-center cursor-default ${
        overlay
          ? `pointer-events-auto ${isVertical ? "max-h-[50%]" : "max-w-[50%]"}`
          : "w-full h-full"
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
    >
      <span
        className={
          overlay
            ? `font-display font-semibold text-secondary/60 bg-white/50 backdrop-blur-[2px] rounded-md select-none truncate ${
                isVertical ? "px-1 py-1.5" : "px-2 py-0.5"
              }`
            : `font-display font-semibold text-secondary select-none truncate ${
                isVertical ? "max-h-full" : "max-w-full"
              }`
        }
        style={{
          fontSize,
          ...(isVertical
            ? {
                writingMode: "vertical-rl" as const,
                textOrientation: "mixed" as const,
                transform: edge === "left" ? "rotate(180deg)" : undefined,
              }
            : undefined),
        }}
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
            className="absolute z-50 bg-white rounded-lg shadow-lg px-3 py-1.5 font-body text-foreground whitespace-nowrap pointer-events-none"
            style={{ fontSize: tooltipFontSize, ...tooltipPosition }}
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
  sizes = DESKTOP_SIZES,
}: GameGraphProps) {
  const { axisLabelFontSize, axisLabelTrack, axisTooltipFontSize } = sizes;
  const outerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const isDraggingTokenRef = useRef(false);
  const resetAnimRef = useRef<number | null>(null);
  const [transform, setTransform] = useState<TransformState>({
    scale: 1,
    panX: 0,
    panY: 0,
  });

  // ---- Track available space from parent ----
  const [availableSize, setAvailableSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setAvailableSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep parent informed of transform changes
  useEffect(() => {
    onTransformChange?.(transform);
  }, [transform, onTransformChange]);

  // ---- Compute full layout from current scale ----
  const layout = computeLayout(
    transform.scale, availableSize.w, availableSize.h, axisLabelTrack,
  );
  const {
    baseSize, viewportW, viewportH,
    effectiveTrackH, effectiveTrackV, effectiveGap,
    progress,
  } = layout;

  // Hard switch: show outside labels OR overlay labels, never both.
  // Flip at a small zoom threshold so labels swap as soon as zoom starts.
  const showOverlayLabels = progress > 0.05;
  const outsideLabelOpacity = showOverlayLabels ? 0 : 1;
  const overlayLabelOpacity = showOverlayLabels ? 1 : 0;
  const overlayFontSize = Math.max(9, axisLabelFontSize * 0.8);

  // Refs for gesture handlers (avoid stale closures)
  const availRef = useRef(availableSize);
  const trackRef = useRef(axisLabelTrack);
  availRef.current = availableSize;
  trackRef.current = axisLabelTrack;

  // ---- Gesture handling ----
  useGesture(
    {
      onDrag: ({ first, last, delta: [dx, dy], event }) => {
        if (first) {
          isDraggingTokenRef.current = !!(event?.target as HTMLElement)?.closest("[data-token]");
          if (resetAnimRef.current) {
            cancelAnimationFrame(resetAnimRef.current);
            resetAnimRef.current = null;
          }
        }
        if (isDraggingTokenRef.current) {
          if (last) isDraggingTokenRef.current = false;
          return;
        }
        setTransform((t) => {
          const l = computeLayout(t.scale, availRef.current.w, availRef.current.h, trackRef.current);
          const clamped = clampPan(t.panX + dx, t.panY + dy, t.scale, l.baseSize, l.viewportW, l.viewportH);
          return { ...t, ...clamped };
        });
        if (last) isDraggingTokenRef.current = false;
      },
      onPinch: ({ first, offset: [scale] }) => {
        if (first && resetAnimRef.current) {
          cancelAnimationFrame(resetAnimRef.current);
          resetAnimRef.current = null;
        }
        const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
        setTransform((t) => {
          const l = computeLayout(clampedScale, availRef.current.w, availRef.current.h, trackRef.current);
          const clamped = clampPan(t.panX, t.panY, clampedScale, l.baseSize, l.viewportW, l.viewportH);
          return { scale: clampedScale, ...clamped };
        });
      },
      onWheel: ({ first, delta: [, dy] }) => {
        if (first && resetAnimRef.current) {
          cancelAnimationFrame(resetAnimRef.current);
          resetAnimRef.current = null;
        }
        setTransform((t) => {
          const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale - dy * 0.002));
          const l = computeLayout(nextScale, availRef.current.w, availRef.current.h, trackRef.current);
          const clamped = clampPan(t.panX, t.panY, nextScale, l.baseSize, l.viewportW, l.viewportH);
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

  // ---- Animated reset on double-tap ----
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const handleDoubleClick = useCallback(() => {
    if (resetAnimRef.current) {
      cancelAnimationFrame(resetAnimRef.current);
    }

    const start = { ...transformRef.current };
    if (start.scale === 1 && start.panX === 0 && start.panY === 0) return;

    const startTime = performance.now();
    const duration = 280;

    function tick() {
      const elapsed = performance.now() - startTime;
      const raw = Math.min(1, elapsed / duration);
      const t = 1 - Math.pow(1 - raw, 3);

      const next: TransformState = {
        scale: lerp(start.scale, 1, t),
        panX: lerp(start.panX, 0, t),
        panY: lerp(start.panY, 0, t),
      };
      setTransform(next);
      onTransformChange?.(next);

      if (raw < 1) {
        resetAnimRef.current = requestAnimationFrame(tick);
      } else {
        resetAnimRef.current = null;
      }
    }

    resetAnimRef.current = requestAnimationFrame(tick);
  }, [onTransformChange]);

  // ---- Auto-scroll when dragging a token near viewport edge (zoomed) ----
  useEffect(() => {
    let rafId: number | null = null;
    let locked = false;
    const vel = { x: 0, y: 0 };

    function runLoop() {
      if (vel.x === 0 && vel.y === 0) {
        rafId = null;
        return;
      }
      setTransform((t) => {
        const l = computeLayout(
          t.scale, availRef.current.w, availRef.current.h, trackRef.current,
        );
        const clamped = clampPan(
          t.panX + vel.x, t.panY + vel.y,
          t.scale, l.baseSize, l.viewportW, l.viewportH,
        );
        return { ...t, ...clamped };
      });
      rafId = requestAnimationFrame(runLoop);
    }

    function onMove(e: PointerEvent) {
      const el = outerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      // Tray lockout: don't auto-scroll until the pointer has entered the
      // non-edge center area of the viewport at least once.
      if (locked) {
        const inCenter =
          e.clientX > rect.left + AUTO_SCROLL_ZONE &&
          e.clientX < rect.right - AUTO_SCROLL_ZONE &&
          e.clientY > rect.top + AUTO_SCROLL_ZONE &&
          e.clientY < rect.bottom - AUTO_SCROLL_ZONE;
        if (inCenter) {
          locked = false;
        } else {
          vel.x = 0;
          vel.y = 0;
          return;
        }
      }

      const next = computeAutoScrollVel(e.clientX, e.clientY, rect);
      vel.x = next.x;
      vel.y = next.y;
      if ((vel.x !== 0 || vel.y !== 0) && rafId === null) {
        rafId = requestAnimationFrame(runLoop);
      }
    }

    function cleanup() {
      vel.x = 0;
      vel.y = 0;
      locked = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", cleanup);
      document.removeEventListener("pointercancel", cleanup);
    }

    function onPointerDown(e: PointerEvent) {
      const tokenEl = (e.target as HTMLElement)?.closest("[data-token]");
      if (!tokenEl || transformRef.current.scale <= 1) return;
      // Lock auto-scroll for tray tokens (those outside the viewport) until
      // the pointer enters the non-edge center area of the graph.
      const viewport = outerRef.current;
      locked = !!viewport && !viewport.contains(tokenEl);
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", cleanup, { once: true });
      document.addEventListener("pointercancel", cleanup, { once: true });
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      cleanup();
    };
  }, []); // all deps are refs or stable setters — safe to leave empty

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (resetAnimRef.current) cancelAnimationFrame(resetAnimRef.current);
    };
  }, []);

  // ---- Render ----
  const hasMeasured = availableSize.w > 0 && availableSize.h > 0;

  return (
    <div ref={measureRef} className="w-full h-full flex items-center justify-center">
      {hasMeasured && (
        <div
          style={{
            display: "grid",
            width: viewportW + 2 * effectiveTrackH + 2 * effectiveGap,
            height: viewportH + 2 * effectiveTrackV + 2 * effectiveGap,
            gridTemplateColumns: `${effectiveTrackH}px 1fr ${effectiveTrackH}px`,
            gridTemplateRows: `${effectiveTrackV}px 1fr ${effectiveTrackV}px`,
            gap: effectiveGap,
          }}
          role="img"
          aria-label={`Graph with axes: ${axisXLow} to ${axisXHigh} (horizontal), ${axisYLow} to ${axisYHigh} (vertical)`}
        >
          {/* Y-axis high label (top) — outside, fades out when zoomed */}
          <div
            className="col-start-2 row-start-1 flex items-end justify-center px-1"
            style={{ opacity: outsideLabelOpacity }}
          >
            <AxisLabel text={axisYHigh} edge="top" fontSize={axisLabelFontSize} tooltipFontSize={axisTooltipFontSize} />
          </div>

          {/* X-axis low label (left) — outside, fades out when zoomed */}
          <div
            className="col-start-1 row-start-2 flex items-center justify-center py-1"
            style={{ opacity: outsideLabelOpacity }}
          >
            <AxisLabel text={axisXLow} edge="left" fontSize={axisLabelFontSize} tooltipFontSize={axisTooltipFontSize} />
          </div>

          {/* Graph viewport (center) — sized by grid, extends to edge at max zoom */}
          <div
            ref={outerRef}
            className="col-start-2 row-start-2 relative overflow-hidden rounded-2xl bg-white border border-secondary/10 shadow-sm"
            style={{ touchAction: "none" }}
            onDoubleClick={handleDoubleClick}
          >
            {/* Graph layer — fixed square, centered in the (possibly non-square)
                 viewport, with zoom applied via explicit width/height */}
            <div
              ref={graphRef}
              className="absolute"
              style={{
                width: baseSize * transform.scale,
                height: baseSize * transform.scale,
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) translate(${transform.panX}px, ${transform.panY}px)`,
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
                  backgroundImage: `radial-gradient(circle, var(--color-secondary) ${0.5 * transform.scale}px, transparent ${0.5 * transform.scale}px)`,
                  backgroundSize: `${20 * transform.scale}px ${20 * transform.scale}px`,
                  backgroundPosition: "center center",
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

          {/* -----------------------------------------------------------
               Overlay axis labels — same grid cell as viewport but a
               separate element so tooltips escape overflow-hidden.
               Fades in when zoomed; each label is tappable / hoverable.
               ----------------------------------------------------------- */}
          {showOverlayLabels && (
            <div
              className="col-start-2 row-start-2 relative z-20 pointer-events-none rounded-2xl"
              style={{ opacity: overlayLabelOpacity }}
            >
              {/* Y-axis high (top-center) */}
              <div className="absolute top-1.5 inset-x-0 flex justify-center">
                <AxisLabel text={axisYHigh} edge="top" fontSize={overlayFontSize} tooltipFontSize={axisTooltipFontSize} overlay />
              </div>

              {/* Y-axis low (bottom-center) */}
              <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
                <AxisLabel text={axisYLow} edge="bottom" fontSize={overlayFontSize} tooltipFontSize={axisTooltipFontSize} overlay />
              </div>

              {/* X-axis low (left-center, vertical) */}
              <div className="absolute left-1.5 inset-y-0 flex items-center">
                <AxisLabel text={axisXLow} edge="left" fontSize={overlayFontSize} tooltipFontSize={axisTooltipFontSize} overlay />
              </div>

              {/* X-axis high (right-center, vertical) */}
              <div className="absolute right-1.5 inset-y-0 flex items-center">
                <AxisLabel text={axisXHigh} edge="right" fontSize={overlayFontSize} tooltipFontSize={axisTooltipFontSize} overlay />
              </div>
            </div>
          )}

          {/* X-axis high label (right) — outside, fades out when zoomed */}
          <div
            className="col-start-3 row-start-2 flex items-center justify-center py-1"
            style={{ opacity: outsideLabelOpacity }}
          >
            <AxisLabel text={axisXHigh} edge="right" fontSize={axisLabelFontSize} tooltipFontSize={axisTooltipFontSize} />
          </div>

          {/* Y-axis low label (bottom) — outside, fades out when zoomed */}
          <div
            className="col-start-2 row-start-3 flex items-start justify-center px-1"
            style={{ opacity: outsideLabelOpacity }}
          >
            <AxisLabel text={axisYLow} edge="bottom" fontSize={axisLabelFontSize} tooltipFontSize={axisTooltipFontSize} />
          </div>
        </div>
      )}
    </div>
  );
}
