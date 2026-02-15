"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";

export default function ProfileSettingsPage() {
  const { user, loading: authLoading, isLinked } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
      return;
    }
    if (!user || !isLinked) return;

    const supabase = createClient();
    supabase
      .from("players")
      .select("display_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setDisplayName(data?.display_name ?? ""));
  }, [user, authLoading, isLinked, router]);

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("players")
      .upsert(
        { id: user.id, display_name: displayName.trim() || null },
        { onConflict: "id" }
      );
    setSaving(false);
    if (error) setMessage({ type: "error", text: error.message });
    else {
      setMessage({ type: "success", text: "Display name updated." });
      router.refresh();
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    window.location.href = "/";
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  if (!isLinked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-secondary">Sign in to change settings.</p>
        <Link href="/" className="text-splash hover:underline">Back home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      <h1 className="font-display text-2xl font-bold text-foreground mb-6">
        Settings
      </h1>

      <section className="space-y-4 mb-8">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Display name
        </h2>
        <form onSubmit={handleSaveDisplayName} className="flex gap-2">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-splash text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
        {message && (
          <p className={message.type === "error" ? "text-red-600 text-sm" : "text-green-600 text-sm"}>
            {message.text}
          </p>
        )}
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Account
        </h2>
        <p className="text-sm text-secondary">
          Signed in as {user?.email ?? "anonymous"}
        </p>
        <p className="text-xs text-secondary font-mono break-all">
          User ID: {user?.id}
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground hover:bg-muted"
        >
          Sign out
        </button>
      </section>

      <Link href="/profile" className="text-splash hover:underline text-sm">
        ← Back to account
      </Link>
    </div>
  );
}
