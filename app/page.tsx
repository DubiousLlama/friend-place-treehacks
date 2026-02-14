"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateInviteCode } from "@/lib/utils";

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Axis labels
  const [xLow, setXLow] = useState("");
  const [xHigh, setXHigh] = useState("");
  const [yLow, setYLow] = useState("");
  const [yHigh, setYHigh] = useState("");

  // Player names (name-slot pattern)
  const [playerNames, setPlayerNames] = useState<string[]>([""]);
  const [creatorName, setCreatorName] = useState("");

  // Game config
  const [endEarlyWhenComplete, setEndEarlyWhenComplete] = useState(true);

  // Default end time: midnight tonight in local timezone
  const todayMidnight = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const [endTime, setEndTime] = useState(() => {
    const d = todayMidnight();
    // Format as datetime-local value: YYYY-MM-DDTHH:mm
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  const addPlayerNameField = () => {
    setPlayerNames((prev) => [...prev, ""]);
  };

  const updatePlayerName = (index: number, value: string) => {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const removePlayerName = (index: number) => {
    setPlayerNames((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!xLow.trim() || !xHigh.trim() || !yLow.trim() || !yHigh.trim()) {
      setError("Please fill in all four axis labels.");
      return;
    }
    if (!creatorName.trim()) {
      setError("Please enter your name.");
      return;
    }

    // Filter out empty names, deduplicate
    const friendNames = [
      ...new Set(
        playerNames.map((n) => n.trim()).filter((n) => n.length > 0)
      ),
    ];

    setCreating(true);
    setError(null);
    const supabase = createClient();

    try {
      // Ensure session
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

      // Ensure player row
      await supabase
        .from("players")
        .upsert({ id: user.id, display_name: creatorName.trim() }, { onConflict: "id" });

      // Compute submissions_lock_at as ISO string
      const lockAt = new Date(endTime).toISOString();

      // Create game (starts in placing immediately)
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
          submissions_lock_at: lockAt,
          end_early_when_complete: endEarlyWhenComplete,
        })
        .select("id")
        .single();

      if (gameError) {
        if (gameError.code === "23505") {
          setCreating(false);
          return handleCreateGame(e);
        }
        setError(gameError.message ?? "Failed to create game");
        return;
      }

      // Batch-insert name slots:
      // 1. Creator's own slot (claimed immediately)
      // 2. Friend name slots (unclaimed, player_id = null)
      const nameSlots = [
        {
          game_id: game.id,
          player_id: user.id,
          display_name: creatorName.trim(),
          claimed_at: new Date().toISOString(),
        },
        ...friendNames.map((name) => ({
          game_id: game.id,
          player_id: null,
          display_name: name,
          claimed_at: null,
        })),
      ];

      const { error: slotsError } = await supabase
        .from("game_players")
        .insert(nameSlots);

      if (slotsError) {
        setError(slotsError.message ?? "Failed to create player slots");
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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 font-sans">
      <main className="w-full max-w-lg flex flex-col items-center gap-8">
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--black)]">
            Friend Place
          </h1>
          <p className="text-[var(--secondary)]">
            Place yourself on the chart, then guess where your friends belong.
            Share the link and see who knows each other best.
          </p>
        </div>

        <form
          onSubmit={handleCreateGame}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--white)] p-6 flex flex-col gap-6"
        >
          <h2 className="text-lg font-semibold text-[var(--black)]">
            Create a game
          </h2>

          {/* Your name */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--black)]">
              Your name
            </label>
            <input
              type="text"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="e.g. Sam"
              maxLength={50}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--black)] placeholder:text-[var(--secondary)]"
            />
          </div>

          {/* Axis labels */}
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[var(--secondary)]">
              Set the two axes of the chart. Each axis has two ends.
            </p>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-[var(--black)] mb-1">
                Horizontal
              </legend>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={xLow}
                  onChange={(e) => setXLow(e.target.value)}
                  placeholder="Left (e.g. Introvert)"
                  maxLength={40}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--black)] placeholder:text-[var(--secondary)]"
                />
                <input
                  type="text"
                  value={xHigh}
                  onChange={(e) => setXHigh(e.target.value)}
                  placeholder="Right (e.g. Extrovert)"
                  maxLength={40}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--black)] placeholder:text-[var(--secondary)]"
                />
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-[var(--black)] mb-1">
                Vertical
              </legend>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={yLow}
                  onChange={(e) => setYLow(e.target.value)}
                  placeholder="Bottom (e.g. Night owl)"
                  maxLength={40}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--black)] placeholder:text-[var(--secondary)]"
                />
                <input
                  type="text"
                  value={yHigh}
                  onChange={(e) => setYHigh(e.target.value)}
                  placeholder="Top (e.g. Early bird)"
                  maxLength={40}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--black)] placeholder:text-[var(--secondary)]"
                />
              </div>
            </fieldset>
          </div>

          {/* Player names */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-[var(--black)]">
              Friends in this game
            </label>
            <p className="text-xs text-[var(--secondary)]">
              Add the names of people who will play. They&apos;ll claim their
              name when they join via the link.
            </p>
            {playerNames.map((name, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => updatePlayerName(i, e.target.value)}
                  placeholder={`Friend ${i + 1}`}
                  maxLength={50}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--black)] placeholder:text-[var(--secondary)]"
                />
                {playerNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePlayerName(i)}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--secondary)] hover:text-red-500 hover:border-red-300 transition-colors"
                    aria-label="Remove"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addPlayerNameField}
              className="self-start rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-sm text-[var(--secondary)] hover:border-[var(--splash)] hover:text-[var(--splash)] transition-colors"
            >
              + Add another friend
            </button>
          </div>

          {/* End time */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--black)]">
              Game ends at
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--black)]"
            />
          </div>

          {/* End early toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={endEarlyWhenComplete}
              onChange={(e) => setEndEarlyWhenComplete(e.target.checked)}
              className="size-4 rounded border-[var(--border)] accent-[var(--splash)]"
            />
            <span className="text-sm text-[var(--secondary)]">
              End early once all names are claimed and everyone has placed
            </span>
          </label>

          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-[var(--splash)] text-[var(--white)] py-3 font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {creating ? "Creating..." : "Create game"}
          </button>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
