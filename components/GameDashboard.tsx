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

  // Deadline info
  const deadline = game.submissions_lock_at
    ? new Date(game.submissions_lock_at)
    : null;
  const now = new Date();
  const isExpired = deadline && deadline < now;

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto">
      {/* Next action prompt */}
      <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-5">
        {!hasPlacedSelf ? (
          <>
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
              Place yourself on the chart
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Drag your token onto the graph to set your position, then guess
              where everyone else goes. (Graph coming in Phase 3.)
            </p>
          </>
        ) : !mySlot.has_submitted ? (
          <>
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
              Guess your friends
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Drag each name onto the chart where you think they belong, then
              submit your placements. (Graph coming in Phase 3.)
            </p>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
              You&apos;re all set!
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Your placements are submitted. Check back later if new friends
              join — you can place them too.
            </p>
          </>
        )}
      </div>

      {/* Invite link */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Invite link
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 font-mono"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {copySuccess ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Player list */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Players ({gamePlayers.length})
        </h2>
        <ul className="space-y-2">
          {/* Claimed players */}
          {claimedPlayers.map((gp) => {
            const isMe = gp.id === mySlot.id;
            const hasPlaced = gp.self_x != null && gp.self_y != null;
            return (
              <li
                key={gp.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                  <span
                    className={`size-2 rounded-full ${hasPlaced ? "bg-emerald-500" : "bg-blue-400"}`}
                    aria-hidden
                  />
                  {gp.display_name}
                  {isMe && (
                    <span className="text-xs text-zinc-500">(you)</span>
                  )}
                </span>
                <span
                  className={`text-xs ${hasPlaced ? "text-emerald-600 dark:text-emerald-400" : gp.has_submitted ? "text-blue-500" : "text-zinc-400"}`}
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
          {/* Unclaimed slots */}
          {unclaimedSlots.map((gp) => (
            <li
              key={gp.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                <span
                  className="size-2 rounded-full bg-zinc-300 dark:bg-zinc-600"
                  aria-hidden
                />
                {gp.display_name}
              </span>
              <span className="text-xs text-zinc-400">Unclaimed</span>
            </li>
          ))}
        </ul>
        {!allClaimed && (
          <p className="mt-3 text-xs text-zinc-500">
            {unclaimedSlots.length} name
            {unclaimedSlots.length !== 1 ? "s" : ""} still waiting to be
            claimed.
          </p>
        )}
      </div>

      {/* Axes info */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Chart axes
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-zinc-500 dark:text-zinc-400">
              Horizontal:{" "}
            </span>
            <span className="text-zinc-800 dark:text-zinc-200">
              {game.axis_x_label_low} vs. {game.axis_x_label_high}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 dark:text-zinc-400">
              Vertical:{" "}
            </span>
            <span className="text-zinc-800 dark:text-zinc-200">
              {game.axis_y_label_low} vs. {game.axis_y_label_high}
            </span>
          </div>
        </div>
      </div>

      {/* Game deadline */}
      {deadline && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Game ends
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {isExpired ? (
              <span className="text-red-500">Game has ended.</span>
            ) : (
              deadline.toLocaleString()
            )}
          </p>
          {game.end_early_when_complete && !isExpired && (
            <p className="text-xs text-zinc-400 mt-1">
              May end early if everyone places.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
