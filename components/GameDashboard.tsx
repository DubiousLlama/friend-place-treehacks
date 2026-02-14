"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
}: GameDashboardProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addError, setAddError] = useState("");

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

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      /* user can copy manually */
    }
  };

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

  const deadline = game.submissions_lock_at
    ? new Date(game.submissions_lock_at)
    : null;
  const now = new Date();
  const isExpired = deadline && deadline < now;

  return (
    <div className="max-w-lg mx-auto rounded-2xl border border-[var(--border)] bg-[var(--white)] p-6 shadow-sm">
      <div className="flex flex-col gap-8">
        {/* Status prompt */}
        <div className="rounded-xl bg-[#FFF5EF] border border-[var(--splash)]/20 p-5">
          {guessedCount === totalFriends && totalFriends > 0 ? (
            <>
              <h2 className="font-semibold text-[var(--black)] mb-1">
                You&apos;re all set!
              </h2>
              <p className="text-sm text-[var(--secondary)]">
                Placed {guessedCount} of {totalFriends} friend
                {totalFriends !== 1 ? "s" : ""}. Add more people below or share
                the link so others can join.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-[var(--black)] mb-1">
                Placed {guessedCount} of {totalFriends} friend
                {totalFriends !== 1 ? "s" : ""}
              </h2>
              <p className="text-sm text-[var(--secondary)]">
                {unguessedCount > 0
                  ? `You still have ${unguessedCount} friend${unguessedCount !== 1 ? "s" : ""} to place. Come back whenever you're ready.`
                  : "Add more people below, or share the link so others can join."}
              </p>
            </>
          )}
          <p className="text-xs text-[var(--secondary)] mt-2">
            Not {mySlot.display_name}?{" "}
            <button
              type="button"
              onClick={onUnclaim}
              className="underline hover:text-[var(--splash)] transition-colors"
            >
              Switch name
            </button>
          </p>
        </div>

        {/* Continue placing button */}
        {unguessedCount > 0 && (
          <button
            type="button"
            onClick={onContinuePlacing}
            className="w-full rounded-xl bg-[var(--splash)] text-[var(--white)] py-3 font-semibold hover:opacity-90 transition-opacity"
          >
            Continue placing ({unguessedCount} remaining)
          </button>
        )}

        {/* Add players */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--black)] mb-2">
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
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--black)] placeholder:text-[var(--secondary)]"
            />
            <button
              type="button"
              onClick={handleAddPlayer}
              disabled={addingPlayer || !newPlayerName.trim()}
              className="shrink-0 rounded-lg bg-[var(--black)] text-[var(--white)] px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {addingPlayer ? "Adding..." : "Add"}
            </button>
          </div>
          {addError && (
            <p className="text-xs text-red-500 mt-1">{addError}</p>
          )}
          <p className="text-xs text-[var(--secondary)] mt-2">
            New names appear as unclaimed slots. Share the link so they can
            claim their name, or go to the graph to place them.
          </p>
          {/* After adding, also show continue placing if there are new unguessed friends */}
          {unguessedCount === 0 && totalFriends > 0 && (
            <button
              type="button"
              onClick={onContinuePlacing}
              className="mt-3 w-full rounded-xl border border-[var(--splash)] text-[var(--splash)] py-2.5 text-sm font-semibold hover:bg-[#FFF5EF] transition-colors"
            >
              Go to graph
            </button>
          )}
        </div>

        {/* Invite link */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--black)] mb-2">
            Invite link
          </h2>
          <div className="flex gap-2 min-w-0">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--white)] px-3 py-2 text-sm text-[var(--black)] font-mono truncate"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="shrink-0 rounded-lg bg-[var(--black)] text-[var(--white)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {copySuccess ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Player list */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--black)] mb-3">
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
                  statusColor = "text-[var(--splash)]";
                } else if (guessedCount > 0) {
                  statusText = `${guessedCount}/${totalFriends} placed`;
                  statusColor = "text-[var(--accent)]";
                } else if (hasPlaced) {
                  statusText = "Self placed";
                  statusColor = "text-[var(--accent)]";
                } else {
                  statusText = "Joined";
                  statusColor = "text-[var(--secondary)]";
                }
              } else {
                // For other players, use the stored flags
                statusText = hasPlaced
                  ? gp.has_submitted ? "Submitted" : "Placed"
                  : "Joined";
                statusColor = hasPlaced
                  ? "text-[var(--splash)]"
                  : gp.has_submitted
                    ? "text-[var(--accent)]"
                    : "text-[var(--secondary)]";
              }

              return (
                <li
                  key={gp.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-[var(--black)]">
                    <span
                      className={`size-2 rounded-full ${hasPlaced ? "bg-[var(--splash)]" : "bg-[var(--accent)]"}`}
                      aria-hidden
                    />
                    {gp.display_name}
                    {isMe && (
                      <span className="text-xs text-[var(--secondary)]">
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
                <span className="flex items-center gap-2 text-[var(--secondary)]">
                  <span
                    className="size-2 rounded-full bg-[var(--border)]"
                    aria-hidden
                  />
                  {gp.display_name}
                </span>
                <span className="text-xs text-[var(--secondary)]">
                  Unclaimed
                </span>
              </li>
            ))}
          </ul>
          {!allClaimed && (
            <p className="mt-3 text-xs text-[var(--secondary)]">
              {unclaimedSlots.length} name
              {unclaimedSlots.length !== 1 ? "s" : ""} still waiting to be
              claimed.
            </p>
          )}
        </div>

        {/* Game deadline */}
        {deadline && (
          <div>
            <h2 className="text-sm font-semibold text-[var(--black)] mb-1">
              Game ends
            </h2>
            <p className="text-sm text-[var(--secondary)]">
              {isExpired ? (
                <span className="text-red-500 font-medium">
                  Game has ended.
                </span>
              ) : (
                deadline.toLocaleString()
              )}
            </p>
            {game.end_early_when_complete && !isExpired && (
              <p className="text-xs text-[var(--secondary)] mt-1">
                May end early if everyone places.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
