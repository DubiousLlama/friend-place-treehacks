"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PENDING_MERGE_ANON_UID_KEY } from "@/lib/auth-constants";
import { MergeDataModal } from "./MergeDataModal";

/**
 * Renders nothing. On mount: if current user has a linked account and
 * localStorage has a pending merge anon uid, shows MergeDataModal.
 * User can merge (POST /api/account/merge) or dismiss; either way we clear the key.
 */
export function AuthMergeChecker() {
  const [pendingAnonId, setPendingAnonId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const run = async () => {
      const stored = typeof window !== "undefined"
        ? localStorage.getItem(PENDING_MERGE_ANON_UID_KEY)
        : null;
      if (!stored) {
        setChecked(true);
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        localStorage.removeItem(PENDING_MERGE_ANON_UID_KEY);
        setChecked(true);
        return;
      }
      const isAnonymous =
        user.is_anonymous === true ||
        (user.app_metadata?.provider === "anonymous");
      if (isAnonymous) {
        setChecked(true);
        return;
      }
      setPendingAnonId(stored);
      setChecked(true);
    };
    run();
  }, []);

  const handleConfirm = async () => {
    if (!pendingAnonId) return;
    const res = await fetch("/api/account/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromUserId: pendingAnonId }),
      credentials: "include",
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    if (typeof data.suggestedDisplayName === "string") {
      try {
        sessionStorage.setItem("fp-suggested-display-name", data.suggestedDisplayName);
      } catch {
        /* ignore */
      }
    }
    localStorage.removeItem(PENDING_MERGE_ANON_UID_KEY);
    setPendingAnonId(null);
    window.location.reload();
  };

  const handleDismiss = () => {
    localStorage.removeItem(PENDING_MERGE_ANON_UID_KEY);
    setPendingAnonId(null);
  };

  if (!checked || !pendingAnonId) return null;
  return (
    <MergeDataModal
      fromUserId={pendingAnonId}
      onConfirm={handleConfirm}
      onDismiss={handleDismiss}
    />
  );
}
