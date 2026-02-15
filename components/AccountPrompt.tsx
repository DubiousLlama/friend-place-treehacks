"use client";

import { useState } from "react";
import { AuthModal } from "./AuthModal";

interface AccountPromptProps {
  /** Optional: call when user dismisses without signing in */
  onDismiss?: () => void;
}

export function AccountPrompt({ onDismiss }: AccountPromptProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-display text-sm font-semibold text-foreground">
          Save your progress
        </h3>
        <p className="mt-1 text-sm text-secondary">
          Create an account to see your game history, replay with the same
          group, and play from any device.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-splash px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Sign in
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-secondary hover:bg-muted"
            >
              Maybe later
            </button>
          )}
        </div>
      </div>
      {open && (
        <AuthModal
          isLinking
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      )}
    </>
  );
}
