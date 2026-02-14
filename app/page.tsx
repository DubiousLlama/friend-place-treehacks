"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateInviteCode } from "@/lib/utils";

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Axis label state
  const [xLow, setXLow] = useState("");
  const [xHigh, setXHigh] = useState("");
  const [yLow, setYLow] = useState("");
  const [yHigh, setYHigh] = useState("");

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!xLow.trim() || !xHigh.trim() || !yLow.trim() || !yHigh.trim()) {
      setError("Please fill in all four axis labels.");
      return;
    }

    setCreating(true);
    setError(null);
    const supabase = createClient();

    try {
      // Ensure we have a session (anonymous sign-in if needed)
      // todo review this
      let {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const { data: anon, error: anonError } =
          await supabase.auth.signInAnonymously();
        if (anonError || !anon?.user) {
          setError("Could not sign in. Please try again.");
          return;
        }
        user = anon.user;
      }

      // Ensure player row exists
      await supabase
        .from("players")
        .upsert({ id: user.id, display_name: null }, { onConflict: "id" });

      // Create the game — starts in "placing" immediately (no lobby phase)
      const inviteCode = generateInviteCode();
      const { data: game, error: gameError } = await supabase
        .from("games")
        .insert({
          invite_code: inviteCode,
          created_by: user.id,
          phase: "placing",
          axis_x_label_low: xLow.trim(),
          axis_x_label_high: xHigh.trim(),
          axis_y_label_low: yLow.trim(),
          axis_y_label_high: yHigh.trim(),
        })
        .select("id")
        .single();

      if (gameError) {
        // Retry on invite_code collision (extremely rare)
        if (gameError.code === "23505") {
          setCreating(false);
          return handleCreateGame(e);
        }
        setError(gameError.message ?? "Failed to create game");
        return;
      }

      // Creator joins their own game
      const { error: joinError } = await supabase.from("game_players").insert({
        game_id: game.id,
        player_id: user.id,
        display_name: "Host",
      });

      if (joinError) {
        setError(joinError.message ?? "Failed to join game");
        return;
      }

      router.push(`/play/${inviteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-zinc-950">
      <main className="w-full max-w-lg flex flex-col items-center gap-8">
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Friend Place
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Place yourself on the chart, then guess where your friends belong.
            Share the link and see who knows each other best.
          </p>
        </div>

        <form
          onSubmit={handleCreateGame}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 flex flex-col gap-6"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Create a game
          </h2>

          {/* Axis labels */}
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Set the two axes of the chart. Each axis has a &ldquo;low&rdquo;
              end and a &ldquo;high&rdquo; end.
            </p>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Horizontal
              </legend>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={xLow}
                  onChange={(e) => setXLow(e.target.value)}
                  placeholder="Left label (e.g. Introvert)"
                  maxLength={40}
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                />
                <input
                  type="text"
                  value={xHigh}
                  onChange={(e) => setXHigh(e.target.value)}
                  placeholder="Right label (e.g. Extrovert)"
                  maxLength={40}
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                />
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Vertical
              </legend>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={yLow}
                  onChange={(e) => setYLow(e.target.value)}
                  placeholder="Bottom label (e.g. Night owl)"
                  maxLength={40}
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                />
                <input
                  type="text"
                  value={yHigh}
                  onChange={(e) => setYHigh(e.target.value)}
                  placeholder="Top label (e.g. Early bird)"
                  maxLength={40}
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                />
              </div>
            </fieldset>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {creating ? "Creating…" : "Create game"}
          </button>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
