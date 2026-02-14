"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Game, GamePlayer } from "@/lib/game-types";

interface GameInfoPanelProps {
  game: Game;
  gamePlayers: GamePlayer[];
  mySlot: GamePlayer;
  inviteCode: string;
  /** How many friends the current user has guessed */
  guessedCount: number;
  /** Called when user wants to release their claimed name */
  onUnclaim: () => void;
}

/**
 * Collapsible pull-down panel that shows game info (invite link, players, deadline)
 * while the user is in the graph/placing view. An arrow button toggles visibility.
 */
export function GameInfoPanel({
  game,
  gamePlayers,
  mySlot,
  inviteCode,
  guessedCount,
  onUnclaim,
}: GameInfoPanelProps) {
  const [open, setOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/play/${inviteCode}`
      : "";

  const claimedPlayers = gamePlayers.filter((gp) => gp.player_id !== null);
  const unclaimedSlots = gamePlayers.filter((gp) => gp.player_id === null);

  const deadline = game.submissions_lock_at
    ? new Date(game.submissions_lock_at)
    : null;
  const isExpired = deadline ? deadline < new Date() : false;

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

  return (
    <div className="relative z-30">
      {/* Toggle button — always visible */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-b-xl bg-white border border-t-0 border-secondary/10 shadow-sm text-sm font-body text-secondary hover:text-foreground transition-colors"
          aria-expanded={open}
          aria-label={open ? "Hide game info" : "Show game info"}
        >
          <span className="text-xs">{open ? "Hide info" : "Game info"}</span>
          <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </motion.svg>
        </button>
      </div>

      {/* Panel content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mx-auto max-w-lg bg-white border border-t-0 border-secondary/10 rounded-b-2xl shadow-lg p-5 flex flex-col gap-5">
              {/* Invite link */}
              <div>
                <h3 className="text-xs font-semibold text-secondary mb-1.5 uppercase tracking-wide">
                  Invite link
                </h3>
                <div className="flex gap-2 min-w-0">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--black)] font-mono truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="shrink-0 rounded-lg bg-[var(--black)] text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    {copySuccess ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Players */}
              <div>
                <h3 className="text-xs font-semibold text-secondary mb-1.5 uppercase tracking-wide">
                  Players ({gamePlayers.length})
                </h3>
                <ul className="space-y-1.5">
                  {claimedPlayers.map((gp) => {
                    const isMe = gp.id === mySlot.id;
                    const hasPlaced = gp.self_x != null && gp.self_y != null;
                    const totalFriends = gamePlayers.filter((g) => g.id !== mySlot.id).length;

                    let statusText: string;
                    let statusColor: string;
                    if (isMe) {
                      if (guessedCount === totalFriends && totalFriends > 0) {
                        statusText = `${guessedCount}/${totalFriends}`;
                        statusColor = "text-splash";
                      } else if (guessedCount > 0) {
                        statusText = `${guessedCount}/${totalFriends}`;
                        statusColor = "text-accent";
                      } else if (hasPlaced) {
                        statusText = "Self placed";
                        statusColor = "text-accent";
                      } else {
                        statusText = "Joined";
                        statusColor = "text-secondary";
                      }
                    } else {
                      statusText = hasPlaced
                        ? gp.has_submitted ? "Submitted" : "Placed"
                        : "Joined";
                      statusColor = hasPlaced
                        ? "text-splash"
                        : gp.has_submitted ? "text-accent" : "text-secondary";
                    }

                    return (
                      <li
                        key={gp.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-1.5 text-foreground">
                          <span
                            className={`size-1.5 rounded-full ${hasPlaced ? "bg-splash" : "bg-accent"}`}
                            aria-hidden
                          />
                          {gp.display_name}
                          {isMe && (
                            <button
                              type="button"
                              onClick={onUnclaim}
                              className="text-secondary underline hover:text-splash transition-colors"
                            >
                              switch
                            </button>
                          )}
                        </span>
                        <span className={statusColor}>
                          {statusText}
                        </span>
                      </li>
                    );
                  })}
                  {unclaimedSlots.map((gp) => (
                    <li
                      key={gp.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-1.5 text-secondary">
                        <span
                          className="size-1.5 rounded-full bg-secondary/30"
                          aria-hidden
                        />
                        {gp.display_name}
                      </span>
                      <span className="text-secondary">Unclaimed</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Deadline */}
              {deadline && (
                <div>
                  <h3 className="text-xs font-semibold text-secondary mb-1 uppercase tracking-wide">
                    Game ends
                  </h3>
                  <p className="text-xs text-foreground">
                    {isExpired ? (
                      <span className="text-red-500 font-medium">
                        Game has ended.
                      </span>
                    ) : (
                      deadline.toLocaleString()
                    )}
                  </p>
                  {game.end_early_when_complete && !isExpired && (
                    <p className="text-[10px] text-secondary mt-0.5">
                      May end early if everyone places.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
