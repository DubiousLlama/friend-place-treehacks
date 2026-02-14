"use client";

import { useState } from "react";
import type { Database } from "@/lib/types/database";

type Game = Database["public"]["Tables"]["games"]["Row"];
type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];

interface GameDashboardProps {
  game: Game;
  gamePlayers: GamePlayer[];
  mySlot: GamePlayer;
  currentPlayerId: string;
  inviteCode: string;
}

export function GameDashboard({
  game,
  gamePlayers,
  mySlot,
  inviteCode,
}: GameDashboardProps) {
  const [copySuccess, setCopySuccess] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/play/${inviteCode}`
      : "";

  const hasPlacedSelf = mySlot.self_x != null && mySlot.self_y != null;

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

  const deadline = game.submissions_lock_at
    ? new Date(game.submissions_lock_at)
    : null;
  const now = new Date();
  const isExpired = deadline && deadline < now;

  return (
    <div className="max-w-lg mx-auto rounded-2xl border border-[var(--border)] bg-[var(--white)] p-6 shadow-sm">
      <div className="flex flex-col gap-8">
      {/* Next action prompt */}
      <div className="rounded-xl bg-[#FFF5EF] border border-[var(--splash)]/20 p-5">
        {!hasPlacedSelf ? (
          <>
            <h2 className="font-semibold text-[var(--black)] mb-1">
              Place yourself on the chart
            </h2>
            <p className="text-sm text-[var(--secondary)]">
              Drag your token onto the graph to set your position, then guess
              where everyone else goes. (Graph coming in Phase 3.)
            </p>
          </>
        ) : !mySlot.has_submitted ? (
          <>
            <h2 className="font-semibold text-[var(--black)] mb-1">
              Guess your friends
            </h2>
            <p className="text-sm text-[var(--secondary)]">
              Drag each name onto the chart where you think they belong, then
              submit your placements. (Graph coming in Phase 3.)
            </p>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-[var(--black)] mb-1">
              You&apos;re all set!
            </h2>
            <p className="text-sm text-[var(--secondary)]">
              Your placements are submitted. Check back later if new friends
              join — you can place them too.
            </p>
          </>
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
                <span
                  className={`text-xs ${hasPlaced ? "text-[var(--splash)]" : gp.has_submitted ? "text-[var(--accent)]" : "text-[var(--secondary)]"}`}
                >
                  {hasPlaced
                    ? gp.has_submitted
                      ? "Submitted"
                      : "Placed"
                    : "Joined"}
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
              <span className="text-xs text-[var(--secondary)]">Unclaimed</span>
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
              <span className="text-red-500 font-medium">Game has ended.</span>
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
