"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateInviteCode } from "@/lib/utils";
import { useAuth } from "@/lib/use-auth";
import type { Database } from "@/lib/types/database";

type SavedGroup = Database["public"]["Tables"]["saved_groups"]["Row"];

const REGEN_COUNT_KEY = "fp-regen-count";
const REGEN_DATE_KEY = "fp-regen-date";
const MAX_REGENS = 10;

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

type FriendRow = {
  id: string;
  value: string;
  resolved?: { playerId: string; displayName: string } | "pending";
  lookingUp?: boolean;
  /** When resolved === "pending", display name the inviter suggests for the invitee. */
  suggestedDisplayName?: string;
};

export interface CreateGameFormProps {
  /** When creating a game from a group page, pass the group id to pre-select it and pre-fill members. */
  initialGroupId?: string;
  /** When provided (e.g. from home page), use these as the initial axes so they match "today's axes" and avoid a second fetch. */
  initialDailyAxes?: AxisSuggestion | null;
}

export function CreateGameForm({ initialGroupId, initialDailyAxes }: CreateGameFormProps = {}) {
  const router = useRouter();
  const { user, isLinked } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([]);
  const [initialGroup, setInitialGroup] = useState<SavedGroup | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId ?? null);
  const [selectedGroupInterests, setSelectedGroupInterests] = useState<string[]>([]);

  const [xLow, setXLow] = useState("");
  const [xHigh, setXHigh] = useState("");
  const [yLow, setYLow] = useState("");
  const [yHigh, setYHigh] = useState("");

  const [dailyAxes, setDailyAxes] = useState<AxisSuggestion | null>(null);
  const [loadingAxes, setLoadingAxes] = useState(true);
  const [regeneratingAxis, setRegeneratingAxis] = useState<"horizontal" | "vertical" | null>(null);
  const [regensLeft, setRegensLeft] = useState(MAX_REGENS);
  const [lastHorizontalPair, setLastHorizontalPair] = useState<{ low: string; high: string } | null>(null);
  const [lastVerticalPair, setLastVerticalPair] = useState<{ low: string; high: string } | null>(null);
  const [pastGameAxes, setPastGameAxes] = useState<string[]>([]);
  const appliedParentAxesRef = useRef(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

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
  }, [user]);

  useEffect(() => {
    if (!isLinked || !user) return;
    const supabase = createClient();
    supabase
      .from("saved_groups")
      .select("id, name")
      .order("created_at", { ascending: false })
      .then(({ data }) => setSavedGroups((data as SavedGroup[]) ?? []));
  }, [isLinked, user]);

  // Keep selectedGroupId in sync with initialGroupId (e.g. from /create?group=id) so axes fetch runs
  useEffect(() => {
    if (initialGroupId != null) {
      setSelectedGroupId(initialGroupId);
    }
  }, [initialGroupId]);

  useEffect(() => {
    if (!initialGroupId || !user) return;
    const supabase = createClient();
    supabase
      .from("saved_groups")
      .select("id, name, interests")
      .eq("id", initialGroupId)
      .single()
      .then(({ data }) => {
        if (data) {
          const g = data as SavedGroup;
          setInitialGroup(g);
          setSelectedGroupInterests(g.interests ?? []);
        }
      });
  }, [initialGroupId, user]);

  useEffect(() => {
    if (!selectedGroupId) {
      setSelectedGroupInterests([]);
      return;
    }
    if (initialGroup?.id === selectedGroupId) {
      setSelectedGroupInterests(initialGroup.interests ?? []);
      return;
    }
    if (initialGroupId === selectedGroupId) {
      return;
    }
    const supabase = createClient();
    supabase
      .from("saved_groups")
      .select("interests")
      .eq("id", selectedGroupId)
      .single()
      .then(({ data }) => {
        setSelectedGroupInterests((data as { interests?: string[] } | null)?.interests ?? []);
      });
  }, [selectedGroupId, initialGroupId, initialGroup?.id, initialGroup?.interests]);

  const [friendRows, setFriendRows] = useState<FriendRow[]>([{ id: "f0", value: "" }]);

  useEffect(() => {
    if (!selectedGroupId) return;
    const supabase = createClient();
    supabase
      .from("group_members")
      .select("player_id, anonymous_display_name, sort_order, players(display_name)")
      .eq("group_id", selectedGroupId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        const members = (data ?? []) as {
          player_id: string | null;
          anonymous_display_name: string | null;
          players?: { display_name: string | null } | null;
        }[];
        setFriendRows(
          members.length
            ? members.map((m, i) => {
                const name = m.player_id
                  ? (m.players?.display_name?.trim() ?? "Member")
                  : (m.anonymous_display_name?.trim() ?? "Guest");
                if (m.player_id) {
                  return {
                    id: `fg-${i}-${m.player_id}`,
                    value: name,
                    resolved: { playerId: m.player_id, displayName: name },
                  } as FriendRow;
                }
                return { id: `fg-${i}-${name}`, value: name };
              })
            : [{ id: "f0", value: "" }]
        );
      });
  }, [selectedGroupId]);

  const lookupEmail = useCallback(async (email: string, rowId: string) => {
    const res = await fetch("/api/users/lookup-by-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setFriendRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          lookingUp: false,
          resolved: data.found
            ? { playerId: data.playerId, displayName: data.displayName ?? "Member" }
            : "pending",
        };
      })
    );
  }, []);

  // Resolve group id for axes: use selected group or initial (from URL) so we fetch group axes when opening /create?group=id
  const groupIdForAxes = selectedGroupId ?? initialGroupId ?? null;

  useEffect(() => {
    setRegensLeft(MAX_REGENS - getRegensUsedToday());
    if (!groupIdForAxes && initialDailyAxes?.x_low != null && initialDailyAxes?.x_high != null && initialDailyAxes?.y_low != null && initialDailyAxes?.y_high != null) {
      appliedParentAxesRef.current = true;
      setDailyAxes(initialDailyAxes);
      setXLow(initialDailyAxes.x_low);
      setXHigh(initialDailyAxes.x_high);
      setYLow(initialDailyAxes.y_low);
      setYHigh(initialDailyAxes.y_high);
      setLoadingAxes(false);
      return;
    }
    appliedParentAxesRef.current = false;

    if (groupIdForAxes) {
      // Group game: client sends interests (from its own RLS fetch). No service role needed.
      fetch("/api/ai/suggest-group-axes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupInterests: selectedGroupInterests }),
      })
        .then((res) => res.json())
        .then((data: AxisSuggestion & { source?: string }) => {
          if (appliedParentAxesRef.current) return;
          setDailyAxes(data);
          setXLow(data.x_low ?? "");
          setXHigh(data.x_high ?? "");
          setYLow(data.y_low ?? "");
          setYHigh(data.y_high ?? "");
        })
        .catch(() => {})
        .finally(() => setLoadingAxes(false));
      return;
    }

    fetch("/api/ai/daily-axis")
      .then((res) => res.json())
      .then((data: AxisSuggestion & { source?: string }) => {
        if (appliedParentAxesRef.current) return;
        setDailyAxes(data);
        setXLow(data.x_low ?? "");
        setXHigh(data.x_high ?? "");
        setYLow(data.y_low ?? "");
        setYHigh(data.y_high ?? "");
      })
      .catch(() => {})
      .finally(() => setLoadingAxes(false));
  }, [groupIdForAxes, initialDailyAxes, selectedGroupInterests]);

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
            groupInterests: selectedGroupInterests.length ? selectedGroupInterests : undefined,
          }),
        });
        const data = await res.json();
        if (res.status === 429) {
          setError(data?.error ?? "Daily limit reached. Resets at midnight UTC.");
          setRegensLeft(0);
          return;
        }
        if (!res.ok) throw new Error(data?.error ?? "Failed to generate");
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
    [regensLeft, regeneratingAxis, xLow, xHigh, yLow, yHigh, dailyAxes, lastHorizontalPair, lastVerticalPair, pastGameAxes, selectedGroupInterests],
  );

  const [creatorName, setCreatorName] = useState("");
  const [endEarlyWhenComplete, setEndEarlyWhenComplete] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("players")
      .select("display_name")
      .eq("id", user.id)
      .single()
      .then(({ data: player }) => {
        const name = player?.display_name != null && String(player.display_name).trim() !== ""
          ? String(player.display_name).trim()
          : null;
        if (name) setCreatorName((current) => (current === "" ? name : current));
      });
  }, [user]);

  const todayMidnight = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const [endTime, setEndTime] = useState(() => {
    const d = todayMidnight();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  const addPlayerNameField = () =>
    setFriendRows((prev) => [...prev, { id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`, value: "" }]);
  const updatePlayerName = (index: number, value: string) => {
    setFriendRows((prev) => {
      const next = [...prev];
      const row = next[index];
      if (!row) return prev;
      next[index] = { ...row, value, resolved: undefined, suggestedDisplayName: undefined };
      return next;
    });
  };
  const updateSuggestedDisplayName = (index: number, value: string) => {
    setFriendRows((prev) => {
      const next = [...prev];
      const row = next[index];
      if (!row) return prev;
      next[index] = { ...row, suggestedDisplayName: value };
      return next;
    });
  };
  const removePlayerName = (index: number) =>
    setFriendRows((prev) => prev.filter((_, i) => i !== index));
  const handleFriendBlur = (index: number) => {
    const row = friendRows[index];
    if (!row || row.resolved !== undefined || row.lookingUp) return;
    const val = row.value.trim();
    if (!val || !val.includes("@")) return;
    setFriendRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, lookingUp: true } : r))
    );
    lookupEmail(val, row.id);
  };

  const handleCreateGame = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!xLow.trim() || !xHigh.trim() || !yLow.trim() || !yHigh.trim()) {
      setError("Please fill in all four axis labels.");
      return;
    }
    if (!creatorName.trim()) {
      setError("Please enter your name.");
      return;
    }
    const rowsWithValue = friendRows.filter((r) => r.value.trim().length > 0);
    const nameSlotsPayload: { game_id: string; player_id: string | null; display_name: string; claimed_at: string | null }[] = [];
    const pendingEmails: string[] = [];
    const pendingDisplayNamesByEmail: Record<string, string | undefined> = {};
    const seenDisplayNames = new Set<string>();
    const seenPlayerIds = new Set<string>();
    for (const row of rowsWithValue) {
      const val = row.value.trim();
      if (row.resolved && row.resolved !== "pending") {
        if (seenPlayerIds.has(row.resolved.playerId)) continue;
        if (seenDisplayNames.has(row.resolved.displayName)) continue;
        seenPlayerIds.add(row.resolved.playerId);
        seenDisplayNames.add(row.resolved.displayName);
        nameSlotsPayload.push({
          game_id: "",
          player_id: row.resolved.playerId,
          display_name: row.resolved.displayName,
          claimed_at: null,
        });
      } else if (row.resolved === "pending" && val.includes("@")) {
        pendingEmails.push(val.toLowerCase());
        const suggested = row.suggestedDisplayName?.trim();
        pendingDisplayNamesByEmail[val.toLowerCase()] = suggested || undefined;
      } else {
        if (seenDisplayNames.has(val)) continue;
        seenDisplayNames.add(val);
        nameSlotsPayload.push({
          game_id: "",
          player_id: null,
          display_name: val,
          claimed_at: null,
        });
      }
    }
    const uniquePending = [...new Set(pendingEmails)];
    const pendingInvites = uniquePending.map((email) => ({
      email,
      displayName: pendingDisplayNamesByEmail[email] ?? undefined,
    }));

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/51997ba0-9d25-4154-b510-db94c1e13d2e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "components/CreateGameForm.tsx:handleCreateGame",
        message: "create game submit pending vs slots",
        data: {
          uniquePending,
          pendingCount: uniquePending.length,
          rowsWithValue: rowsWithValue.map((r) => ({ value: r.value.trim(), resolved: r.resolved })),
        },
        timestamp: Date.now(),
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion

    setCreating(true);
    setError(null);
    const supabase = createClient();
    try {
      let { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        const { data: anon, error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError || !anon?.user) {
          setError("Could not sign in. Please try again.");
          setCreating(false);
          return;
        }
        u = anon.user;
      }
      await supabase
        .from("players")
        .upsert({ id: u.id, display_name: creatorName.trim() }, { onConflict: "id" });
      const lockAt = new Date(endTime).toISOString();
      const inviteCode = generateInviteCode();
      const { data: game, error: gameError } = await supabase
        .from("games")
        .insert({
          invite_code: inviteCode,
          created_by: u.id,
          phase: "placing",
          axis_x_label_low: xLow.trim(),
          axis_x_label_high: xHigh.trim(),
          axis_y_label_low: yLow.trim(),
          axis_y_label_high: yHigh.trim(),
          submissions_lock_at: lockAt,
          end_early_when_complete: endEarlyWhenComplete,
          ...(selectedGroupId && { group_id: selectedGroupId }),
        })
        .select("id")
        .single();
      if (gameError) {
        if (gameError.code === "23505") {
          setCreating(false);
          return handleCreateGame(e);
        }
        setError(gameError.message ?? "Failed to create game");
        setCreating(false);
        return;
      }
      const otherSlots = nameSlotsPayload.filter((s) => s.player_id !== u.id);
      const slots = [
        { game_id: game.id, player_id: u.id, display_name: creatorName.trim(), claimed_at: new Date().toISOString() },
        ...otherSlots.map((s) => ({ ...s, game_id: game.id })),
      ];
      const { error: slotsError } = await supabase.from("game_players").insert(slots);
      if (slotsError) {
        setError(slotsError.message ?? "Failed to create player slots");
        setCreating(false);
        return;
      }
      if (pendingInvites.length > 0) {
        await fetch(`/api/games/${game.id}/invite-by-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invites: pendingInvites }),
        });
      }
      router.push(`/play/${inviteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  return (
    <form
      onSubmit={handleCreateGame}
      className="w-full min-w-0 max-w-lg rounded-xl border border-surface-muted bg-white p-6 flex flex-col gap-6"
    >
      <h2 className="text-lg font-semibold text-black">Create a game</h2>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-black">Your name</label>
        <input
          type="text"
          value={creatorName}
          onChange={(e) => setCreatorName(e.target.value)}
          placeholder="e.g. Sam"
          maxLength={50}
          className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
        />
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-black">Friends in this game</label>
        <p className="text-xs text-secondary">Add names or email addresses. Use an email to add someone with an account or send them an invite.</p>
        {friendRows.map((row, i) => (
          <div key={row.id} className="flex flex-col gap-1">
            <div className="flex gap-2">
              <input
                type="text"
                value={row.value}
                onChange={(e) => updatePlayerName(i, e.target.value)}
                onBlur={() => handleFriendBlur(i)}
                placeholder={row.value.includes("@") ? "Email" : `Friend ${i + 1} (name or email)`}
                maxLength={80}
                className="flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
              />
              {friendRows.length > 1 && (
                <button type="button" onClick={() => removePlayerName(i)} className="rounded-lg border border-surface-muted px-3 py-2 text-sm text-secondary hover:text-red-500 hover:border-red-300 transition-colors" aria-label="Remove">&times;</button>
              )}
            </div>
            {row.lookingUp && <p className="text-xs text-secondary">Looking up…</p>}
            {row.resolved && row.resolved !== "pending" && (
              <p className="text-xs text-green-600">Added as {row.resolved.displayName} (account)</p>
            )}
            {row.resolved === "pending" && row.value.trim() && (
              <div className="ml-2 border-l-2 border-surface-muted pl-3 flex flex-col gap-2">
                <p className="text-xs text-secondary">Invite will be sent to {row.value.trim()}</p>
                <input
                  type="text"
                  value={row.suggestedDisplayName ?? ""}
                  onChange={(e) => updateSuggestedDisplayName(i, e.target.value)}
                  placeholder="Display name for them (they can change it)"
                  maxLength={50}
                  className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
                />
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={addPlayerNameField} className="self-start rounded-lg border border-dashed border-surface-muted px-3 py-1.5 text-sm text-secondary hover:border-splash hover:text-splash transition-colors">+ Add another friend</button>
      </div>

      <div className="border-t border-surface-muted pt-4">
        <button
          type="button"
          onClick={() => setCustomizeOpen((o) => !o)}
          className="flex items-center gap-2 w-full text-left text-sm font-medium text-secondary hover:text-black transition-colors"
          aria-expanded={customizeOpen}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform ${customizeOpen ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          Customize
        </button>
        {customizeOpen && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-4 min-w-0">
              <p className="text-sm text-secondary">
                {loadingAxes
                  ? (groupIdForAxes ? "Generating axes for this game…" : "Loading today's axes…")
                  : (groupIdForAxes ? "Axes for this game – edit or use the reload next to each axis." : "Today's axes – edit or use the reload next to each axis.")}
              </p>
              <fieldset className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2">
                  <legend className="text-sm font-medium text-black">Horizontal</legend>
                  {!loadingAxes && (
                    <button
                      type="button"
                      onClick={() => handleRegenerateAxis("horizontal")}
                      disabled={regeneratingAxis !== null || regensLeft <= 0}
                      className="inline-flex items-center justify-center rounded-lg border border-surface-muted p-1.5 text-secondary hover:border-splash hover:text-splash disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title={regensLeft <= 0 ? "No regenerations left today" : `New horizontal axis (${regensLeft} left today)`}
                      aria-label={regensLeft <= 0 ? "No regenerations left" : "Regenerate horizontal axis"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={regeneratingAxis === "horizontal" ? "animate-spin" : ""}>
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex gap-2 min-w-0">
                  <input type="text" value={xLow} onChange={(e) => setXLow(e.target.value)} placeholder="Left" maxLength={20} className="min-w-0 flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary" />
                  <input type="text" value={xHigh} onChange={(e) => setXHigh(e.target.value)} placeholder="Right" maxLength={20} className="min-w-0 flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary" />
                </div>
              </fieldset>
              <fieldset className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2">
                  <legend className="text-sm font-medium text-black">Vertical</legend>
                  {!loadingAxes && (
                    <button
                      type="button"
                      onClick={() => handleRegenerateAxis("vertical")}
                      disabled={regeneratingAxis !== null || regensLeft <= 0}
                      className="inline-flex items-center justify-center rounded-lg border border-surface-muted p-1.5 text-secondary hover:border-splash hover:text-splash disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title={regensLeft <= 0 ? "No regenerations left today" : `New vertical axis (${regensLeft} left today)`}
                      aria-label={regensLeft <= 0 ? "No regenerations left" : "Regenerate vertical axis"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={regeneratingAxis === "vertical" ? "animate-spin" : ""}>
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex gap-2 min-w-0">
                  <input type="text" value={yLow} onChange={(e) => setYLow(e.target.value)} placeholder="Bottom" maxLength={20} className="min-w-0 flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary" />
                  <input type="text" value={yHigh} onChange={(e) => setYHigh(e.target.value)} placeholder="Top" maxLength={20} className="min-w-0 flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary" />
                </div>
              </fieldset>
            </div>

            {((isLinked && savedGroups.length > 0) || initialGroupId) && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-black">
                  {initialGroupId ? "Creating game for this group" : "Start from a saved group"}
                </label>
                <select value={selectedGroupId ?? ""} onChange={(e) => setSelectedGroupId(e.target.value || null)} className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black">
                  <option value="">None</option>
                  {selectedGroupId && !initialGroup && !savedGroups.some((g) => g.id === selectedGroupId) && (
                    <option value={selectedGroupId}>This group</option>
                  )}
                  {[
                    ...(initialGroup && !savedGroups.some((g) => g.id === initialGroup.id) ? [initialGroup] : []),
                    ...savedGroups,
                  ].map((g) => (
                    <option key={g.id} value={g.id}>{g.name?.trim() || "Unnamed group"}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-black">Game ends at</label>
              <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black" />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={endEarlyWhenComplete} onChange={(e) => setEndEarlyWhenComplete(e.target.checked)} className="size-4 rounded border-surface-muted accent-splash" />
              <span className="text-sm text-secondary">End early once all names are claimed and everyone has placed</span>
            </label>
          </div>
        )}
      </div>

      <button type="submit" disabled={creating} className="rounded-xl bg-splash text-white py-3 font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity">
        {creating ? "Creating..." : "Create game"}
      </button>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </form>
  );
}
