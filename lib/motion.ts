/** Shared Framer Motion animation presets */

export const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

export const tapScale = { scale: 0.95 };

export const hoverLift = { y: -2 };

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};
