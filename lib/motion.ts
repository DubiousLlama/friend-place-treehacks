/**
 * Shared spring / transition presets for gamefeel.
 * See .cursor/plans/ui_guide.md for design spec.
 */

/** Spring transition for token placement and snapping */
export const springTransition = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
};

/** Bouncy cubic-bezier for CSS transitions */
export const bounceCubic = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/** Press / tap scale — tactile mobile feedback */
export const tapScale = { scale: 0.98 };

/** Hover lift for desktop — translateY(-4px) with enhanced shadow */
export const hoverLift = { y: -4 };

/** Drop pulse: brief scale burst on successful token placement */
export const dropPulse = {
  scale: [1, 1.2, 1],
  transition: { duration: 0.3, ease: "easeOut" },
};

/** Staggered children entrance — 100ms delay per child */
export const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

/** Individual child entrance animation */
export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
    },
  },
};
