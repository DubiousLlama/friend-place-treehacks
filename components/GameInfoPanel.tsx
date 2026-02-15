"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { shareOrCopy } from "@/lib/utils";
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
  /** Called when user wants to change their display name (same identity) */
  onEditName: (newName: string) => void | Promise<void>;
  /** Whether the current user is the game host (creator) */
  isHost: boolean;
  /** Called when the host ends the game */
  onEndGame: () => void;
  /** Called when the host deletes the game */
  onDeleteGame?: () => void | Promise<void>;
  /** "dropdown" = collapsible overlay (default, for mobile).
   *  "sidebar" = always-visible, flush with sidebar styling (for desktop). */
  variant?: "dropdown" | "sidebar";
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
  onEditName,
  isHost,
  onEndGame,
  onDeleteGame,
  variant = "dropdown",
}: GameInfoPanelProps) {
  const [open, setOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied">("idle");
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [editNameError, setEditNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

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

  const handleShare = useCallback(async () => {
    if (!shareUrl) return;
    const result = await shareOrCopy(shareUrl);
    if (result === "shared" || result === "copied") {
      setShareStatus(result);
      setTimeout(() => setShareStatus("idle"), 2000);
    }
  }, [shareUrl]);

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

  // ---- Shared content sections ----

  const shareSection = (
    <div>
      <button
        type="button"
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-black text-white py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
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
  );

  const playersSection = (
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
              statusText = `0/${totalFriends}`;
              statusColor = "text-accent";
            } else {
              statusText = "Joined";
              statusColor = "text-secondary";
            }
          } else {
            const theirTotal = gamePlayers.filter((g) => g.id !== gp.id).length;
            const theirCount = gp.guesses_count ?? 0;
            if (hasPlaced || theirCount > 0) {
              statusText = `${theirCount}/${theirTotal}`;
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
              className="flex items-center justify-between text-xs"
            >
              <span className="flex items-center gap-1.5 text-foreground min-w-0">
                <span
                  className={`size-1.5 rounded-full shrink-0 ${hasPlaced ? "bg-splash" : "bg-accent"}`}
                  aria-hidden
                />
                {isMe && editingName ? (
                  <span className="flex flex-wrap items-center gap-1 min-w-0">
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
                      placeholder="Name"
                      maxLength={50}
                      className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-xs w-24 min-w-0"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveEditName}
                      disabled={savingName || !editNameValue.trim()}
                      className="text-xs text-splash hover:underline disabled:opacity-50 shrink-0"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingName(false);
                        setEditNameValue("");
                        setEditNameError("");
                      }}
                      className="text-xs text-secondary hover:underline shrink-0"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    {gp.display_name}
                    {isMe && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditNameValue(mySlot.display_name);
                            setEditingName(true);
                            setEditNameError("");
                          }}
                          className="text-secondary underline hover:text-splash transition-colors"
                        >
                          edit
                        </button>
                        <button
                          type="button"
                          onClick={onUnclaim}
                          className="text-secondary underline hover:text-splash transition-colors"
                        >
                          switch
                        </button>
                      </>
                    )}
                  </>
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
      {editNameError && (
        <p className="text-[10px] text-red-500 mt-1">{editNameError}</p>
      )}
    </div>
  );

  const deadlineSection = deadline ? (
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
  ) : null;

  const endGameButton = isHost ? (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("End the game and reveal results? This can't be undone.")) {
          onEndGame();
        }
      }}
      className="w-full rounded-lg border border-red-300 text-red-600 py-1.5 text-xs font-semibold hover:bg-red-50 transition-colors"
    >
      End game &amp; reveal results
    </button>
  ) : null;

  const deleteGameButton = isHost && onDeleteGame ? (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("Permanently delete this game? All placements and results will be lost. This can't be undone.")) {
          onDeleteGame();
        }
      }}
      className="w-full rounded-lg border border-secondary/30 text-secondary py-1.5 text-xs font-medium hover:bg-black/5 transition-colors"
    >
      Delete game
    </button>
  ) : null;

  // ---- Sidebar variant: always visible, flush styling ----
  if (variant === "sidebar") {
    return (
      <div className="px-4 py-4 flex flex-col gap-4 border-b border-black/5">
        {shareSection}
        {playersSection}
        {deadlineSection}
        {endGameButton}
        {deleteGameButton}
      </div>
    );
  }

  // ---- Dropdown variant (default): collapsible overlay ----
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
              {shareSection}
              {playersSection}
              {deadlineSection}
              {endGameButton}
              {deleteGameButton}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
