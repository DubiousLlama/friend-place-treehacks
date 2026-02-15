"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { shareOrCopy } from "@/lib/utils";
import type { Database } from "@/lib/types/database";

type Game = Database["public"]["Tables"]["games"]["Row"];
type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];

interface GameDashboardProps {
  game: Game;
  gamePlayers: GamePlayer[];
  mySlot: GamePlayer;
  currentPlayerId: string;
  inviteCode: string;
  /** How many friends the current user has guessed (from guesses table) */
  guessedCount: number;
  /** Called when user wants to go back to the graph */
  onContinuePlacing: () => void;
  /** Called after a new player is added so the parent can refresh */
  onPlayersChanged: () => void;
  /** Called when user wants to release their claimed name */
  onUnclaim: () => void;
  /** Called when user wants to change their display name (same identity) */
  onEditName: (newName: string) => void | Promise<void>;
  /** Whether the current user is the game host (creator) */
  isHost: boolean;
  /** Called when the host ends the game */
  onEndGame: () => void;
}

export function GameDashboard({
  game,
  gamePlayers,
  mySlot,
  inviteCode,
  guessedCount,
  onContinuePlacing,
  onPlayersChanged,
  onUnclaim,
  onEditName,
  isHost,
  onEndGame,
}: GameDashboardProps) {
  const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied">("idle");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addError, setAddError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [editNameError, setEditNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const supabase = createClient();

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/play/${inviteCode}`
      : "";

  const otherPlayers = gamePlayers.filter((gp) => gp.id !== mySlot.id);
  const totalFriends = otherPlayers.length;
  const unguessedCount = totalFriends - guessedCount;

  const claimedPlayers = gamePlayers.filter((gp) => gp.player_id !== null);
  const unclaimedSlots = gamePlayers.filter((gp) => gp.player_id === null);
  const allClaimed = unclaimedSlots.length === 0;

  const handleShare = useCallback(async () => {
    if (!shareUrl) return;
    const result = await shareOrCopy(shareUrl);
    if (result === "shared" || result === "copied") {
      setShareStatus(result);
      setTimeout(() => setShareStatus("idle"), 2000);
    }
  }, [shareUrl]);

  const handleAddPlayer = async () => {
    const name = newPlayerName.trim();
    if (!name) return;
    setAddingPlayer(true);
    setAddError("");

    const { error } = await supabase.from("game_players").insert({
      game_id: game.id,
      display_name: name,
      player_id: null,
    });

    if (error) {
      if (error.code === "23505") {
        setAddError("That name is already in the game.");
      } else {
        setAddError("Failed to add player.");
      }
    } else {
      setNewPlayerName("");
      onPlayersChanged();
    }
    setAddingPlayer(false);
  };

  const handleSaveEditName = async () => {
    const name = editNameValue.trim();
    if (!name) return;
    setSavingName(true);
    setEditNameError("");
    try {
      await onEditName(name);
      setEditingName(false);
      setEditNameValue("");
    } catch (err) {
      setEditNameError(err instanceof Error ? err.message : "Failed to update name.");
    }
    setSavingName(false);
  };

  const deadline = game.submissions_lock_at
    ? new Date(game.submissions_lock_at)
    : null;
  const now = new Date();
  const isExpired = deadline && deadline < now;

  return (
    <div className="max-w-lg mx-auto rounded-2xl border border-surface-muted bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-8">
        {/* Status prompt */}
        <div className="rounded-xl bg-[#FFF5EF] border border-splash/20 p-5">
          {guessedCount === totalFriends && totalFriends > 0 ? (
            <>
              <h2 className="font-semibold text-black mb-1">
                You&apos;re all set!
              </h2>
              <p className="text-sm text-secondary">
                Placed {guessedCount} of {totalFriends} friend
                {totalFriends !== 1 ? "s" : ""}. Add more people below or share
                the link so others can join.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-black mb-1">
                Placed {guessedCount} of {totalFriends} friend
                {totalFriends !== 1 ? "s" : ""}
              </h2>
              <p className="text-sm text-secondary">
                {unguessedCount > 0
                  ? `You still have ${unguessedCount} friend${unguessedCount !== 1 ? "s" : ""} to place. Come back whenever you're ready.`
                  : "Add more people below, or share the link so others can join."}
              </p>
            </>
          )}
          <p className="text-xs text-[var(--secondary)] mt-2">
            {editingName ? (
              <span className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => {
                    setEditNameValue(e.target.value);
                    setEditNameError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveEditName();
                    }
                    if (e.key === "Escape") {
                      setEditingName(false);
                      setEditNameValue("");
                      setEditNameError("");
                    }
                  }}
                  placeholder="Display name"
                  maxLength={50}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--black)] w-32"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveEditName}
                  disabled={savingName || !editNameValue.trim()}
                  className="text-xs font-medium text-[var(--splash)] hover:underline disabled:opacity-50"
                >
                  {savingName ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingName(false);
                    setEditNameValue("");
                    setEditNameError("");
                  }}
                  className="text-xs text-[var(--secondary)] hover:underline"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditNameValue(mySlot.display_name);
                    setEditingName(true);
                    setEditNameError("");
                  }}
                  className="underline hover:text-[var(--splash)] transition-colors"
                >
                  Edit name
                </button>
                {" · "}
                Not {mySlot.display_name}?{" "}
                <button
                  type="button"
                  onClick={onUnclaim}
                  className="underline hover:text-[var(--splash)] transition-colors"
                >
                  Switch name
                </button>
              </>
            )}
          </p>
          {editNameError && (
            <p className="text-xs text-red-500 mt-1">{editNameError}</p>
          )}
        </div>

        {/* Continue placing button */}
        {unguessedCount > 0 && (
          <button
            type="button"
            onClick={onContinuePlacing}
            className="w-full rounded-xl bg-splash text-white py-3 font-semibold hover:opacity-90 transition-opacity"
          >
            Continue placing ({unguessedCount} remaining)
          </button>
        )}

        {/* Add players */}
        <div>
          <h2 className="text-sm font-semibold text-black mb-2">
            Add players
          </h2>
          <div className="flex gap-2 min-w-0">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddPlayer();
                }
              }}
              placeholder="Friend's name"
              maxLength={50}
              className="min-w-0 flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
            />
            <button
              type="button"
              onClick={handleAddPlayer}
              disabled={addingPlayer || !newPlayerName.trim()}
              className="shrink-0 rounded-lg bg-black text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {addingPlayer ? "Adding..." : "Add"}
            </button>
          </div>
          {addError && (
            <p className="text-xs text-red-500 mt-1">{addError}</p>
          )}
          <p className="text-xs text-secondary mt-2">
            New names appear as unclaimed slots. Share the link so they can
            claim their name, or go to the graph to place them.
          </p>
          {/* After adding, also show continue placing if there are new unguessed friends */}
          {unguessedCount === 0 && totalFriends > 0 && (
            <button
              type="button"
              onClick={onContinuePlacing}
              className="mt-3 w-full rounded-xl border border-splash text-splash py-2.5 text-sm font-semibold hover:bg-[#FFF5EF] transition-colors"
            >
              Go to graph
            </button>
          )}
        </div>

        {/* Share invite */}
        <div>
          <button
            type="button"
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-black text-white py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {/* Share icon */}
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
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            {shareStatus === "copied"
              ? "Link copied!"
              : shareStatus === "shared"
                ? "Shared!"
                : "Share invite"}
          </button>
        </div>

        {/* Player list */}
        <div>
          <h2 className="text-sm font-semibold text-black mb-3">
            Players ({gamePlayers.length})
          </h2>
          <ul className="space-y-2">
            {claimedPlayers.map((gp) => {
              const isMe = gp.id === mySlot.id;
              const hasPlaced = gp.self_x != null && gp.self_y != null;

              // For the current user, derive status from actual guess progress
              let statusText: string;
              let statusColor: string;
              if (isMe) {
                if (guessedCount === totalFriends && totalFriends > 0) {
                  statusText = `${guessedCount}/${totalFriends} placed`;
                  statusColor = "text-splash";
                } else if (guessedCount > 0) {
                  statusText = `${guessedCount}/${totalFriends} placed`;
                  statusColor = "text-accent";
                } else if (hasPlaced) {
                  statusText = `0/${totalFriends} placed`;
                  statusColor = "text-accent";
                } else {
                  statusText = "Joined";
                  statusColor = "text-secondary";
                }
              } else {
                // For other players, show guess count progress
                const theirTotal = gamePlayers.filter((g) => g.id !== gp.id).length;
                const theirCount = gp.guesses_count ?? 0;
                if (hasPlaced || theirCount > 0) {
                  statusText = `${theirCount}/${theirTotal} placed`;
                  statusColor = theirCount === theirTotal && theirTotal > 0
                    ? "text-splash"
                    : "text-accent";
                } else {
                  statusText = "Joined";
                  statusColor = "text-secondary";
                }
              }

              return (
                <li
                  key={gp.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-black">
                    <span
                      className={`size-2 rounded-full ${hasPlaced ? "bg-splash" : "bg-accent"}`}
                      aria-hidden
                    />
                    {gp.display_name}
                    {isMe && (
                      <span className="text-xs text-secondary">
                        (you)
                      </span>
                    )}
                  </span>
                  <span className={`text-xs ${statusColor}`}>
                    {statusText}
                  </span>
                </li>
              );
            })}
            {unclaimedSlots.map((gp) => (
              <li
                key={gp.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-secondary">
                  <span
                    className="size-2 rounded-full bg-surface-muted"
                    aria-hidden
                  />
                  {gp.display_name}
                </span>
                <span className="text-xs text-secondary">
                  Unclaimed
                </span>
              </li>
            ))}
          </ul>
          {!allClaimed && (
            <p className="mt-3 text-xs text-secondary">
              {unclaimedSlots.length} name
              {unclaimedSlots.length !== 1 ? "s" : ""} still waiting to be
              claimed.
            </p>
          )}
        </div>

        {/* Game deadline */}
        {deadline && (
          <div>
            <h2 className="text-sm font-semibold text-black mb-1">
              Game ends
            </h2>
            <p className="text-sm text-secondary">
              {isExpired ? (
                <span className="text-red-500 font-medium">
                  Game has ended.
                </span>
              ) : (
                deadline.toLocaleString()
              )}
            </p>
            {game.end_early_when_complete && !isExpired && (
              <p className="text-xs text-secondary mt-1">
                May end early if everyone places.
              </p>
            )}
          </div>
        )}

        {/* Host: End Game button */}
        {isHost && (
          <div className="pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("End the game and reveal results? This can't be undone.")) {
                  onEndGame();
                }
              }}
              className="w-full rounded-xl border border-red-300 text-red-600 py-2.5 text-sm font-semibold hover:bg-red-50 transition-colors"
            >
              End game &amp; reveal results
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
