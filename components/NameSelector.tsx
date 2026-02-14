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
}

export function NameSelector({
  gameId,
  gamePlayers,
  currentPlayerId,
  onClaimed,
}: NameSelectorProps) {
  const [claiming, setClaiming] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const unclaimedSlots = gamePlayers.filter((gp) => gp.player_id === null);

  const handleClaim = async (slotId: string) => {
    setClaiming(true);
    setError(null);
    try {
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
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Who are you?
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pick your name from the list to join the game.
          </p>
        </div>

        {/* Unclaimed name slots */}
        {unclaimedSlots.length > 0 && (
          <div className="flex flex-col gap-2">
            {unclaimedSlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => handleClaim(slot.id)}
                disabled={claiming}
                className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-left hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50 transition-colors"
              >
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {slot.display_name}
                </span>
                <span className="text-xs text-zinc-400">
                  {claiming ? "Claiming..." : "I'm this person"}
                </span>
              </button>
            ))}
          </div>
        )}

        {unclaimedSlots.length === 0 && !addingNew && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            All names have been claimed.
          </p>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          or
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
        </div>

        {/* Add new player */}
        {!addingNew ? (
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
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
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={claiming || !newName.trim()}
                className="flex-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 text-sm font-medium disabled:opacity-60"
              >
                {claiming ? "Joining..." : "Join game"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingNew(false);
                  setNewName("");
                }}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-500"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
