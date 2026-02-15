"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PENDING_MERGE_ANON_UID_KEY } from "@/lib/auth-constants";

interface AuthModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  /** If set, we're prompting to "link" this anon user (e.g. from results). */
  isLinking?: boolean;
  /** Initial tab when opening the modal. */
  initialMode?: "signin" | "signup";
  /** After OAuth or email confirmation, redirect here (e.g. /join?token=xxx). */
  returnPath?: string;
}

export function AuthModal({ onClose, onSuccess, isLinking, initialMode = "signin", returnPath }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const supabase = createClient();

  /** Before starting any sign-in that might replace the current session, store anon id for merge. */
  const setPendingMergeIfAnonymous = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.is_anonymous) {
      typeof window !== "undefined" &&
        localStorage.setItem(PENDING_MERGE_ANON_UID_KEY, user.id);
    }
  };

  const getRedirectTo = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const base = `${origin}/auth/callback`;
    if (returnPath) return `${base}?next=${encodeURIComponent(returnPath)}`;
    return base;
  };

  const handleGoogle = async () => {
    setLoading(true);
    setMessage(null);
    await setPendingMergeIfAnonymous();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getRedirectTo() },
    });
    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(false);
    }
    // else: redirect happens
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setMessage(null);
    await setPendingMergeIfAnonymous();

    if (mode === "signup") {
      if (!password.trim()) {
        setMessage({ type: "error", text: "Please enter a password." });
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setMessage({ type: "error", text: "Passwords don't match." });
        setLoading(false);
        return;
      }
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: { emailRedirectTo: getRedirectTo() },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
        setLoading(false);
        return;
      }
      if (signUpData?.user?.id && phone.trim()) {
        await supabase
          .from("players")
          .upsert(
            { id: signUpData.user.id, phone: phone.trim() },
            { onConflict: "id" }
          );
      }
      setMessage({
        type: "success",
        text: "Check your email for the confirmation link.",
      });
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
        setLoading(false);
        return;
      }
      onSuccess?.();
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-lg border border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {isLinking ? "Save your progress" : "Sign in"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-secondary hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-sm text-secondary">
          {isLinking
            ? "Create an account to see your game history and replay with the same group."
            : "Use Google or email to sign in."}
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="mt-4 w-full rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-secondary">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-secondary"
            required
          />
          <input
            type="password"
            placeholder={mode === "signup" ? "Create password" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-secondary"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />
          {mode === "signup" && (
            <>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-secondary"
                autoComplete="new-password"
                required
              />
              <input
                type="tel"
                placeholder="Phone (optional, for game reminders)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-secondary"
              />
            </>
          )}
          {message && (
            <p
              className={`text-sm ${message.type === "error" ? "text-red-600" : "text-green-600"}`}
            >
              {message.text}
            </p>
          )}
          <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setMessage(null);
                  setConfirmPassword("");
                }}
                className="text-sm text-splash hover:underline"
              >
                {mode === "signin" ? "Don't have an account? Create one." : "Sign in instead"}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="ml-auto rounded-lg bg-splash px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
          </div>
        </form>
      </div>
    </div>
  );
}
