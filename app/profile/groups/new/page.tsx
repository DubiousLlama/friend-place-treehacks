"use client";

import { useState, FormEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";

const NAME_MAX_LENGTH = 100;

export default function NewGroupPage() {
  const { user, loading: authLoading, isLinked } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || creating) return;
    setError(null);
    setCreating(true);
    const supabase = createClient();
    const trimmedName = name.trim().slice(0, NAME_MAX_LENGTH) || null;

    const { data: player } = await supabase
      .from("players")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const { data: group, error: groupErr } = await supabase
      .from("saved_groups")
      .insert({ owner_id: user.id, name: trimmedName })
      .select("id")
      .single();

    if (groupErr || !group) {
      setError("Could not create group");
      setCreating(false);
      return;
    }

    const { error: memberErr } = await supabase.from("group_members").insert({
      group_id: group.id,
      player_id: user.id,
      is_anonymous: false,
      sort_order: 0,
    });

    if (memberErr) {
      setError("Could not create group");
      setCreating(false);
      return;
    }

    setCreating(false);
    router.push(`/groups/${group.id}`);
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
        <p className="text-center text-secondary">Sign in to see your groups.</p>
        <Link href="/" className="text-splash hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12 font-sans">
      <main className="w-full max-w-lg flex flex-col gap-6">
        <Link
          href="/profile/groups"
          className="text-sm text-secondary hover:text-splash"
        >
          ← Back to groups
        </Link>
        <div className="w-full rounded-xl border border-surface-muted bg-white p-6 flex flex-col gap-6">
          <h1 className="text-2xl font-bold tracking-tight text-black">
            Create a group
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-black">Group name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={NAME_MAX_LENGTH}
                placeholder="Group name (optional)"
                className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
                disabled={creating}
              />
            </label>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-splash text-white px-4 py-2 text-sm font-medium hover:bg-splash/90 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create group"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
