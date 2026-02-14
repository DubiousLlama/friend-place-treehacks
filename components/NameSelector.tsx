"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];

interface NameSelectorProps {
  gameId: string;
  gamePlayers: GamePlayer[];
  currentPlayerId: string;
  onClaimed: () => void;
  /** When switching identity: the game_players.id of the currently held slot */
  currentSlotId?: string;
  /** Cancel the identity switch (go back to where the user was) */
  onCancel?: () => void;
}

export function NameSelector({
  gameId,
  gamePlayers,
  currentPlayerId,
  onClaimed,
  currentSlotId,
  onCancel,
}: NameSelectorProps) {
  const [claiming, setClaiming] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const isSwitching = !!currentSlotId;
  const currentSlot = isSwitching
    ? gamePlayers.find((gp) => gp.id === currentSlotId) ?? null
    : null;
  const unclaimedSlots = gamePlayers.filter((gp) => gp.player_id === null);

  /** Wipe the old slot's ownership and placement data (used during switch). */
  const unclaimCurrentSlot = async () => {
    if (!currentSlotId) return;

    // Delete guesses made by the old identity
    await supabase
      .from("guesses")
      .delete()
      .eq("game_id", gameId)
      .eq("guesser_game_player_id", currentSlotId);

    // Release the slot
    await supabase
      .from("game_players")
      .update({
        player_id: null,
        claimed_at: null,
        self_x: null,
        self_y: null,
        has_submitted: false,
      })
      .eq("id", currentSlotId);
  };

  const handleClaim = async (slotId: string) => {
    // In switch mode, clicking the current slot → cancel (no DB changes)
    if (isSwitching && slotId === currentSlotId) {
      onCancel?.();
      return;
    }

    setClaiming(true);
    setError(null);
    try {
      // If switching, unclaim the old slot first
      if (isSwitching) {
        await unclaimCurrentSlot();
      }

      // Ensure player row
      await supabase
        .from("players")
        .upsert({ id: currentPlayerId }, { onConflict: "id" });

      // Claim the slot
      const { error: claimError } = await supabase
        .from("game_players")
        .update({
          player_id: currentPlayerId,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", slotId)
        .is("player_id", null); // Only claim if still unclaimed
      if (claimError) {
        setError(claimError.message);
        return;
      }
      onClaimed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setClaiming(false);
    }
  };

  const handleAddAndClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setClaiming(true);
    setError(null);
    try {
      // If switching, unclaim the old slot first
      if (isSwitching) {
        await unclaimCurrentSlot();
      }

      // Ensure player row
      await supabase
        .from("players")
        .upsert({ id: currentPlayerId, display_name: name }, { onConflict: "id" });

      // Insert new game_player row (self-claimed)
      const { error: insertError } = await supabase
        .from("game_players")
        .insert({
          game_id: gameId,
          player_id: currentPlayerId,
          display_name: name,
          claimed_at: new Date().toISOString(),
        });

      if (insertError) {
        if (insertError.code === "23505") {
          setError("That name is already taken in this game.");
        } else {
          setError(insertError.message);
        }
        return;
      }
      onClaimed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-muted bg-white p-6 flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-black mb-1">
            {isSwitching ? "Switch identity" : "Who are you?"}
          </h1>
          <p className="text-sm text-secondary">
            {isSwitching
              ? "Pick a different name, or tap your current name to go back."
              : "Pick your name from the list to join the game."}
          </p>
        </div>

        {/* Current identity — shown only in switch mode */}
        {isSwitching && currentSlot && (
          <button
            type="button"
            onClick={() => onCancel?.()}
            disabled={claiming}
            className="flex items-center justify-between rounded-lg border-2 border-splash bg-[#FFF5EF] px-4 py-3 text-left transition-colors hover:bg-[#FFE8D9] disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <svg
                className="size-4 text-splash shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium text-black">
                {currentSlot.display_name}
              </span>
            </span>
            <span className="text-xs text-splash font-medium">Current</span>
          </button>
        )}

        {/* Unclaimed name slots */}
        {unclaimedSlots.length > 0 && (
          <div className="flex flex-col gap-2">
            {unclaimedSlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => handleClaim(slot.id)}
                disabled={claiming}
                className="flex items-center justify-between rounded-lg border border-surface-muted bg-surface px-4 py-3 text-left hover:border-splash hover:bg-[#FFF5EF] disabled:opacity-50 transition-colors"
              >
                <span className="font-medium text-black">
                  {slot.display_name}
                </span>
                <span className="text-xs text-secondary">
                  {claiming
                    ? "Claiming..."
                    : isSwitching
                      ? "Switch to"
                      : "That\u2019s me"}
                </span>
              </button>
            ))}
          </div>
        )}

        {unclaimedSlots.length === 0 && !addingNew && (
          <p className="text-sm text-secondary">
            {isSwitching
              ? "No other names available to switch to."
              : "All names have been claimed."}
          </p>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-secondary">
          <div className="flex-1 h-px bg-surface-muted" />
          or
          <div className="flex-1 h-px bg-surface-muted" />
        </div>

        {/* Add new player */}
        {!addingNew ? (
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            className="rounded-lg border border-dashed border-surface-muted px-4 py-3 text-sm text-secondary hover:border-splash hover:text-splash transition-colors"
          >
            + I&apos;m not on the list — add myself
          </button>
        ) : (
          <form onSubmit={handleAddAndClaim} className="flex flex-col gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
              autoFocus
              className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={claiming || !newName.trim()}
                className="flex-1 rounded-lg bg-splash text-white py-2 text-sm font-medium disabled:opacity-60"
              >
                {claiming ? "Joining..." : "Join game"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingNew(false);
                  setNewName("");
                }}
                className="rounded-lg border border-surface-muted px-3 py-2 text-sm text-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Cancel button — switch mode only */}
        {isSwitching && (
          <button
            type="button"
            onClick={onCancel}
            disabled={claiming}
            className="w-full rounded-lg border border-surface-muted px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:border-foreground/20 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
