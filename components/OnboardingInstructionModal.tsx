"use client";

import { motion, AnimatePresence } from "framer-motion";

const POPUP_COPY: Record<1 | 2, { title: string; body: string }> = {
  1: {
    title: "How it works",
    body: "Each axis represents a spectrum of vibes. Place yourself in accordance with what you are, not what you like. You'll get bonus points if your friends place you in the same place you placed yourself.",
  },
  2: {
    title: "Place your friends",
    body: "Place your friends where you think they belong based on their vibes. You get points for placing them close to where they placed themselves.",
  },
};

interface OnboardingInstructionModalProps {
  variant: 1 | 2;
  onDismiss: () => void;
}

export function OnboardingInstructionModal({
  variant,
  onDismiss,
}: OnboardingInstructionModalProps) {
  const { title, body } = POPUP_COPY[variant];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-lg"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 25,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
        >
          <h2
            id="onboarding-title"
            className="font-display text-lg font-semibold text-foreground"
          >
            {title}
          </h2>
          <p className="mt-2 text-sm text-secondary">{body}</p>
          <div className="mt-6">
            <button
              type="button"
              onClick={onDismiss}
              className="w-full rounded-lg bg-splash px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
