"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/use-auth";
import { AuthModal } from "@/components/AuthModal";

function JoinContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"idle" | "resolving" | "accepting" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Redirect game invites to play page with claim param (old email links)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setStatus("resolving");
      try {
        const res = await fetch(`/api/join?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.target_type === "game" && data.invite_code) {
          window.location.href = `/play/${data.invite_code}?claim=${encodeURIComponent(token)}`;
          return;
        }
      } catch {
        if (!cancelled) setStatus("idle");
      }
      if (!cancelled) setStatus("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const acceptInvite = useCallback(async () => {
    if (!token) return;
    setStatus("accepting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong");
        setStatus("error");
        return;
      }
      if (data.redirect) {
        setStatus("done");
        window.location.href = data.redirect;
        return;
      }
      setStatus("error");
      setErrorMessage("Invalid response");
    } catch {
      setErrorMessage("Network error");
      setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    if (authLoading || !token || status === "resolving") return;
    if (status !== "idle") return;
    if (user) {
      acceptInvite();
    }
  }, [authLoading, user, token, status, acceptInvite]);

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-secondary">Invalid or missing invite link.</p>
        <Link href="/" className="text-splash hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-secondary">
          Sign in to accept this invite. You’ll be added to the group or game once you’re signed in.
        </p>
        <button
          type="button"
          onClick={() => setShowAuthModal(true)}
          className="rounded-lg bg-splash px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Sign in
        </button>
        <Link href="/" className="text-splash hover:underline">
          Back home
        </Link>
        {showAuthModal && (
          <AuthModal
            returnPath={`/join?token=${encodeURIComponent(token)}`}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              setShowAuthModal(false);
              acceptInvite();
            }}
          />
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-red-600">{errorMessage ?? "Something went wrong."}</p>
        <Link href="/" className="text-splash hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <p className="text-secondary">
        {status === "resolving"
          ? "Opening invite…"
          : status === "accepting" || status === "done"
            ? "Accepting invite…"
            : "Loading…"}
      </p>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-secondary">Loading…</p>
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
