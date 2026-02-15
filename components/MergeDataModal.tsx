"use client";

import { useState } from "react";

interface MergeDataModalProps {
  fromUserId: string;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
}

export function MergeDataModal({
  fromUserId: _fromUserId,
  onConfirm,
  onDismiss,
}: MergeDataModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onDismiss();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-lg border border-border">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Merge your progress?
        </h2>
        <p className="mt-2 text-sm text-secondary">
          You had game progress on this device. Add it to your account so all
          your games and scores are in one place?
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-splash px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Merging…" : "Merge into my account"}
          </button>
        </div>
      </div>
    </div>
  );
}
