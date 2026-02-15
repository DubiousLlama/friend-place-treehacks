"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateInviteCode } from "@/lib/utils";
import { useAuth } from "@/lib/use-auth";
import type { Database } from "@/lib/types/database";

type SavedGroup = Database["public"]["Tables"]["saved_groups"]["Row"];
type SavedGroupMember = Database["public"]["Tables"]["saved_group_members"]["Row"];

// ── localStorage helpers for rate-limiting regenerations ──
const REGEN_COUNT_KEY = "fp-regen-count";
const REGEN_DATE_KEY = "fp-regen-date";
const MAX_REGENS = 2;

function getRegensUsedToday(): number {
  if (typeof window === "undefined") return 0;
  const storedDate = localStorage.getItem(REGEN_DATE_KEY);
  const today = new Date().toISOString().slice(0, 10);
  if (storedDate !== today) {
    localStorage.setItem(REGEN_DATE_KEY, today);
    localStorage.setItem(REGEN_COUNT_KEY, "0");
    return 0;
  }
  return parseInt(localStorage.getItem(REGEN_COUNT_KEY) ?? "0", 10);
}

function incrementRegenCount(): void {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(REGEN_DATE_KEY, today);
  const current = getRegensUsedToday();
  localStorage.setItem(REGEN_COUNT_KEY, String(current + 1));
}

interface AxisSuggestion {
  x_low: string;
  x_high: string;
  y_low: string;
  y_high: string;
}

export default function Home() {
  const router = useRouter();
  const { user, isLinked } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Axis labels
  const [xLow, setXLow] = useState("");
  const [xHigh, setXHigh] = useState("");
  const [yLow, setYLow] = useState("");
  const [yHigh, setYHigh] = useState("");

  // AI axis state
  const [dailyAxes, setDailyAxes] = useState<AxisSuggestion | null>(null);
  const [loadingAxes, setLoadingAxes] = useState(true);
  const [regeneratingAxis, setRegeneratingAxis] = useState<"horizontal" | "vertical" | null>(null);
  const [regensLeft, setRegensLeft] = useState(MAX_REGENS);
  const [lastHorizontalPair, setLastHorizontalPair] = useState<{ low: string; high: string } | null>(null);
  const [lastVerticalPair, setLastVerticalPair] = useState<{ low: string; high: string } | null>(null);
  const [pastGameAxes, setPastGameAxes] = useState<string[]>([]);

  // Fetch current user's recent game axes for better regenerate suggestions
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("games")
      .select("axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (!data?.length) return;
        const formatted = data.map(
          (g) =>
            `${g.axis_x_label_low} ↔ ${g.axis_x_label_high} | ${g.axis_y_label_low} ↔ ${g.axis_y_label_high}`,
        );
        setPastGameAxes(formatted);
      });
  }, [user?.id]);

  // Fetch saved groups when linked
  useEffect(() => {
    if (!isLinked || !user) return;
    const supabase = createClient();
    supabase
      .from("saved_groups")
      .select("id, name")
      .order("created_at", { ascending: false })
      .then(({ data }) => setSavedGroups((data as SavedGroup[]) ?? []));
  }, [isLinked, user]);

  // Load group members when a group is selected
  useEffect(() => {
    if (!selectedGroupId) return;
    const supabase = createClient();
    supabase
      .from("saved_group_members")
      .select("display_name, sort_order")
      .eq("group_id", selectedGroupId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        const names = (data as SavedGroupMember[] ?? []).map((m) => m.display_name);
        setPlayerNames(names.length ? names.map((n) => n) : [""]);
      });
  }, [selectedGroupId]);

  // Fetch daily axis on mount → prefill inputs
  useEffect(() => {
    setRegensLeft(MAX_REGENS - getRegensUsedToday());

    fetch("/api/ai/daily-axis")
      .then((res) => res.json())
      .then((data: AxisSuggestion & { source?: string }) => {
        setDailyAxes(data);
        // Pre-fill inputs with the daily axes
        setXLow(data.x_low);
        setXHigh(data.x_high);
        setYLow(data.y_low);
        setYHigh(data.y_high);
      })
      .catch(() => {
        // Silently fail — user can still type manually
      })
      .finally(() => setLoadingAxes(false));
  }, []);

  const handleRegenerateAxis = useCallback(
    async (axis: "horizontal" | "vertical") => {
      if (regensLeft <= 0 || regeneratingAxis) return;
      setRegeneratingAxis(axis);
      setError(null);
      try {
        const previousPair = axis === "horizontal" ? lastHorizontalPair : lastVerticalPair;
        const res = await fetch("/api/ai/suggest-axes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            axis,
            currentAxes: { x_low: xLow, x_high: xHigh, y_low: yLow, y_high: yHigh },
            dailyAxes,
            previousPair: previousPair ?? undefined,
            pastGameAxes: pastGameAxes.length ? pastGameAxes : undefined,
          }),
        });
        if (!res.ok) throw new Error("Failed to generate");
        const data = await res.json();
        if (axis === "horizontal") {
          setXLow(data.x_low);
          setXHigh(data.x_high);
          setLastHorizontalPair({ low: data.x_low, high: data.x_high });
        } else {
          setYLow(data.y_low);
          setYHigh(data.y_high);
          setLastVerticalPair({ low: data.y_low, high: data.y_high });
        }
        incrementRegenCount();
        setRegensLeft((n) => n - 1);
      } catch {
        setError("Couldn't generate new axes. You can still type your own!");
      } finally {
        setRegeneratingAxis(null);
      }
    },
    [regensLeft, regeneratingAxis, xLow, xHigh, yLow, yHigh, dailyAxes, lastHorizontalPair, lastVerticalPair, pastGameAxes],
  );

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
          <h1 className="text-3xl font-bold tracking-tight text-black">
            Friend Place
          </h1>
          <p className="text-secondary">
            Place yourself on the chart, then guess where your friends belong.
            Share the link and see who knows each other best.
          </p>
        </div>

        <form
          onSubmit={handleCreateGame}
          className="w-full min-w-0 max-w-lg rounded-xl border border-surface-muted bg-white p-6 flex flex-col gap-6"
        >
          <h2 className="text-lg font-semibold text-black">
            Create a game
          </h2>

          {/* Your name */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-black">
              Your name
            </label>
            <input
              type="text"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="e.g. Sam"
              maxLength={50}
              className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
            />
          </div>

          {/* Axis labels — constrained width so no horizontal scroll on mobile */}
          <div className="flex flex-col gap-4 min-w-0">
            <p className="text-sm text-secondary">
              {loadingAxes ? "Loading today's axes..." : "Today's axes – edit or use the reload next to each axis."}
            </p>

            <fieldset className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2">
                <legend className="text-sm font-medium text-black">
                  Horizontal
                </legend>
                {!loadingAxes && (
                  <button
                    type="button"
                    onClick={() => handleRegenerateAxis("horizontal")}
                    disabled={regeneratingAxis !== null || regensLeft <= 0}
                    className="inline-flex items-center justify-center rounded-lg border border-surface-muted p-1.5 text-secondary hover:border-splash hover:text-splash disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={
                      regensLeft <= 0
                        ? "No regenerations left today"
                        : `New horizontal axis (${regensLeft} left today)`
                    }
                    aria-label={regensLeft <= 0 ? "No regenerations left" : "Regenerate horizontal axis"}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={regeneratingAxis === "horizontal" ? "animate-spin" : ""}
                    >
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex gap-2 min-w-0">
                <input
                  type="text"
                  value={xLow}
                  onChange={(e) => setXLow(e.target.value)}
                  placeholder="Left"
                  maxLength={20}
                  className="min-w-0 flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
                />
                <input
                  type="text"
                  value={xHigh}
                  onChange={(e) => setXHigh(e.target.value)}
                  placeholder="Right"
                  maxLength={20}
                  className="min-w-0 flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
                />
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2">
                <legend className="text-sm font-medium text-black">
                  Vertical
                </legend>
                {!loadingAxes && (
                  <button
                    type="button"
                    onClick={() => handleRegenerateAxis("vertical")}
                    disabled={regeneratingAxis !== null || regensLeft <= 0}
                    className="inline-flex items-center justify-center rounded-lg border border-surface-muted p-1.5 text-secondary hover:border-splash hover:text-splash disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={
                      regensLeft <= 0
                        ? "No regenerations left today"
                        : `New vertical axis (${regensLeft} left today)`
                    }
                    aria-label={regensLeft <= 0 ? "No regenerations left" : "Regenerate vertical axis"}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={regeneratingAxis === "vertical" ? "animate-spin" : ""}
                    >
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex gap-2 min-w-0">
                <input
                  type="text"
                  value={yLow}
                  onChange={(e) => setYLow(e.target.value)}
                  placeholder="Bottom"
                  maxLength={20}
                  className="min-w-0 flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
                />
                <input
                  type="text"
                  value={yHigh}
                  onChange={(e) => setYHigh(e.target.value)}
                  placeholder="Top"
                  maxLength={20}
                  className="min-w-0 flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
                />
              </div>
            </fieldset>
          </div>

          {/* Saved group (if signed in) */}
          {isLinked && savedGroups.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-black">
                Start from a saved group
              </label>
              <select
                value={selectedGroupId ?? ""}
                onChange={(e) =>
                  setSelectedGroupId(e.target.value || null)
                }
                className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black"
              >
                <option value="">None</option>
                {savedGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Player names */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-black">
              Friends in this game
            </label>
            <p className="text-xs text-secondary">
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
                  className="flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
                />
                {playerNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePlayerName(i)}
                    className="rounded-lg border border-surface-muted px-3 py-2 text-sm text-secondary hover:text-red-500 hover:border-red-300 transition-colors"
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
              className="self-start rounded-lg border border-dashed border-surface-muted px-3 py-1.5 text-sm text-secondary hover:border-splash hover:text-splash transition-colors"
            >
              + Add another friend
            </button>
          </div>

          {/* End time */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-black">
              Game ends at
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black"
            />
          </div>

          {/* End early toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={endEarlyWhenComplete}
              onChange={(e) => setEndEarlyWhenComplete(e.target.checked)}
              className="size-4 rounded border-surface-muted accent-splash"
            />
            <span className="text-sm text-secondary">
              End early once all names are claimed and everyone has placed
            </span>
          </label>

          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-splash text-white py-3 font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
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
