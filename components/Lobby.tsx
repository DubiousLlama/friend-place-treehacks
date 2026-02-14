"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Game = Database["public"]["Tables"]["games"]["Row"];
type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];
type Guess = Database["public"]["Tables"]["guesses"]["Row"];

interface GameDashboardProps {
  game: Game;
  currentPlayerId: string;
  inviteCode: string;
}

export function GameDashboard({
  game,
  currentPlayerId,
  inviteCode,
}: GameDashboardProps) {
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [myGuesses, setMyGuesses] = useState<Guess[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    const [playersRes, guessesRes] = await Promise.all([
      supabase
        .from("game_players")
        .select("*")
        .eq("game_id", game.id)
        .order("joined_at", { ascending: true }),
      supabase
        .from("guesses")
        .select("*")
        .eq("game_id", game.id)
        .eq("guesser_id", currentPlayerId),
    ]);
    if (playersRes.data) setGamePlayers(playersRes.data as GamePlayer[]);
    if (guessesRes.data) setMyGuesses(guessesRes.data as Guess[]);
  }, [game.id, currentPlayerId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime: new players joining, players updating self-placement
  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-players-${game.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_players",
          filter: `game_id=eq.${game.id}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, supabase, fetchData]);

  const me = gamePlayers.find((gp) => gp.player_id === currentPlayerId);
  const others = gamePlayers.filter(
    (gp) => gp.player_id !== currentPlayerId
  );

  const hasPlacedSelf = me?.self_x != null && me?.self_y != null;
  const guessedIds = new Set(myGuesses.map((g) => g.target_id));
  const unguessedPlayers = others.filter(
    (gp) => !guessedIds.has(gp.player_id)
  );
  const allGuessed = others.length > 0 && unguessedPlayers.length === 0;

  // Reveals: players I've guessed who have also placed themselves
  const reveals = others
    .filter(
      (gp) =>
        guessedIds.has(gp.player_id) &&
        gp.self_x != null &&
        gp.self_y != null
    )
    .map((gp) => {
      const guess = myGuesses.find((g) => g.target_id === gp.player_id);
      return { player: gp, guess: guess! };
    });

  // Players I've guessed but who haven't placed yet
  const pendingReveals = others.filter(
    (gp) =>
      guessedIds.has(gp.player_id) &&
      (gp.self_x == null || gp.self_y == null)
  );

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/play/${inviteCode}`
      : "";

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
    <div className="flex flex-col gap-6 max-w-lg mx-auto">
      {/* Next action prompt */}
      <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-5">
        {!hasPlacedSelf ? (
          <>
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
              Step 1: Place yourself
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Drag your token onto the chart to place yourself. (Graph coming in
              Phase 3.)
            </p>
          </>
        ) : unguessedPlayers.length > 0 ? (
          <>
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
              Step 2: Guess your friends
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {unguessedPlayers.length} player
              {unguessedPlayers.length !== 1 ? "s" : ""} left to guess:{" "}
              {unguessedPlayers.map((p) => p.display_name).join(", ")}.
            </p>
          </>
        ) : allGuessed && reveals.length < others.length ? (
          <>
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
              All guessed! Waiting on friends
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {pendingReveals.length} player
              {pendingReveals.length !== 1 ? "s" : ""} still need to place
              themselves before you can see the truth.
            </p>
          </>
        ) : allGuessed && reveals.length === others.length && others.length > 0 ? (
          <>
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
              All reveals unlocked!
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Everyone has placed — scroll down to see the results.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
              Invite some friends
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Share the link below to get started!
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
        {gamePlayers.length === 0 ? (
          <p className="text-sm text-zinc-500">No players yet.</p>
        ) : (
          <ul className="space-y-2">
            {gamePlayers.map((gp) => {
              const isMe = gp.player_id === currentPlayerId;
              const hasPlaced = gp.self_x != null && gp.self_y != null;
              return (
                <li
                  key={gp.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <span
                      className={`size-2 rounded-full ${hasPlaced ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                      aria-hidden
                    />
                    {gp.display_name}
                    {isMe && (
                      <span className="text-xs text-zinc-500">(you)</span>
                    )}
                  </span>
                  <span
                    className={`text-xs ${hasPlaced ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}
                  >
                    {hasPlaced ? "Placed" : "Not placed yet"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Axis info */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Chart axes
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-zinc-500 dark:text-zinc-400">Horizontal: </span>
            <span className="text-zinc-800 dark:text-zinc-200">
              {game.axis_x_label_low} ↔ {game.axis_x_label_high}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 dark:text-zinc-400">Vertical: </span>
            <span className="text-zinc-800 dark:text-zinc-200">
              {game.axis_y_label_low} ↔ {game.axis_y_label_high}
            </span>
          </div>
        </div>
      </div>

      {/* Reveals */}
      {reveals.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Reveals
          </h2>
          <ul className="space-y-3">
            {reveals.map(({ player, guess }) => {
              const dx = (guess.guess_x - (player.self_x ?? 0));
              const dy = (guess.guess_y - (player.self_y ?? 0));
              const distance = Math.sqrt(dx * dx + dy * dy);
              const accuracy = Math.max(0, 1 - distance / 1.414);
              const pct = Math.round(accuracy * 100);
              return (
                <li
                  key={player.id}
                  className="flex items-center justify-between text-sm border-b border-zinc-100 dark:border-zinc-800 pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {player.display_name}
                    </span>
                    <span className="text-xs text-zinc-500">
                      You guessed ({guess.guess_x.toFixed(2)},{" "}
                      {guess.guess_y.toFixed(2)}) — actually (
                      {player.self_x?.toFixed(2)}, {player.self_y?.toFixed(2)})
                    </span>
                  </div>
                  <span
                    className={`font-semibold ${pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-500"}`}
                  >
                    {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Pending reveals */}
      {pendingReveals.length > 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Waiting for placement
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            You&apos;ve guessed these players, but they haven&apos;t placed
            themselves yet. Come back later to see the truth!
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {pendingReveals.map((gp) => (
              <li
                key={gp.id}
                className="rounded-full bg-zinc-200 dark:bg-zinc-800 px-3 py-1 text-xs text-zinc-700 dark:text-zinc-300"
              >
                {gp.display_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
