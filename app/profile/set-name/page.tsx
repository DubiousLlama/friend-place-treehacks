"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";

const SUGGESTED_STORAGE_KEY = "fp-suggested-display-name";

export default function SetNamePage() {
  const router = useRouter();
  const { user, loading: authLoading, isLinked } = useAuth();
  const [name, setName] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || authLoading) return;

    const run = async () => {
      let prefill: string | null = null;

      try {
        const fromStorage = sessionStorage.getItem(SUGGESTED_STORAGE_KEY);
        if (fromStorage && fromStorage.trim()) {
          prefill = fromStorage.trim();
          sessionStorage.removeItem(SUGGESTED_STORAGE_KEY);
        }
      } catch {
        /* ignore */
      }

      if (!prefill) {
        const res = await fetch("/api/account/suggested-display-name", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.suggestedDisplayName === "string" && data.suggestedDisplayName.trim()) {
            prefill = data.suggestedDisplayName.trim();
          }
        }
      }

      if (!prefill && user.user_metadata) {
        const meta = user.user_metadata as Record<string, unknown>;
        const fromGoogle =
          (typeof meta.full_name === "string" && meta.full_name.trim()) ||
          (typeof meta.name === "string" && meta.name.trim());
        if (fromGoogle) prefill = (meta.full_name as string)?.trim() || (meta.name as string)?.trim();
      }

      if (prefill) setName(prefill);
      setInitialized(true);
    };

    run();
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
      return;
    }
    if (!authLoading && user && !isLinked) {
      router.replace("/profile");
      return;
    }
  }, [authLoading, user, isLinked, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a display name.");
      return;
    }
    if (!user) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: upsertError } = await supabase
      .from("players")
      .upsert({ id: user.id, display_name: trimmed }, { onConflict: "id" })
      .select("id");
    if (upsertError) {
      setError(upsertError.message ?? "Failed to save.");
      setSaving(false);
      return;
    }
    try {
      sessionStorage.setItem("fp-just-set-display-name", "1");
      sessionStorage.setItem("fp-display-name-just-set", trimmed);
    } catch {
      /* ignore */
    }
    router.replace("/profile");
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  if (!isLinked) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 font-sans">
      <main className="w-full max-w-md flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight text-black text-center">
          Set your name
        </h1>
        <p className="text-sm text-secondary text-center">
          This is how you’ll appear in games. You can change it later in settings.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="text-sm font-medium text-black" htmlFor="display-name">
            Display name
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam"
            maxLength={50}
            disabled={!initialized}
            className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary disabled:opacity-70"
          />
          <button
            type="submit"
            disabled={saving || !initialized}
            className="rounded-xl bg-splash text-white py-3 font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saving ? "Saving..." : "Continue"}
          </button>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </form>
        <Link href="/profile" className="text-sm text-secondary hover:text-splash text-center">
          Skip for now
        </Link>
      </main>
    </div>
  );
}
