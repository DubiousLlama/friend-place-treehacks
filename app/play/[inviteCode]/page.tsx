"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GameDashboard } from "@/components/Lobby";
import type { Database } from "@/lib/types/database";

type Game = Database["public"]["Tables"]["games"]["Row"];

export default function PlayPage() {
  const params = useParams();
  const inviteCode = params.inviteCode as string;
  const [game, setGame] = useState<Game | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [isInGame, setIsInGame] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchGameAndMembership = useCallback(async () => {
    // Ensure session
    let {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const { data: anon } = await supabase.auth.signInAnonymously();
      user = anon?.user ?? null;
    }
    if (!user) {
      setLoading(false);
      return;
    }
    setCurrentPlayerId(user.id);

    // Fetch game by invite code
    const { data: rawGame, error: gameErr } = await supabase
      .from("games")
      .select("*")
      .eq("invite_code", inviteCode)
      .single();

    if (gameErr || !rawGame) {
      setGame(null);
      setLoading(false);
      return;
    }
    const gameData = rawGame as Game;
    setGame(gameData);

    // Check if user is already in the game
    const { data: membership } = await supabase
      .from("game_players")
      .select("id")
      .eq("game_id", gameData.id)
      .eq("player_id", user.id)
      .maybeSingle();

    setIsInGame(!!membership);
    setLoading(false);
  }, [inviteCode, supabase]);

  useEffect(() => {
    fetchGameAndMembership();
  }, [fetchGameAndMembership]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = joinName.trim() || "Player";
    if (!currentPlayerId || !game) return;
    setJoining(true);
    setJoinError(null);

    try {
      // Ensure player row
      await supabase
        .from("players")
        .upsert(
          { id: currentPlayerId, display_name: name },
          { onConflict: "id" }
        );

      // Insert into game_players
      const { error } = await supabase.from("game_players").insert({
        game_id: game.id,
        player_id: currentPlayerId,
        display_name: name,
      });

      if (error) {
        if (error.code === "23505") {
          // Already in game (duplicate key) — just proceed
          setIsInGame(true);
          return;
        }
        setJoinError(error.message);
        return;
      }

      setIsInGame(true);
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setJoining(false);
    }
  };

  // ---------- Render states ----------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Game not found
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-sm">
          This invite link may be wrong or the game may have been deleted.
        </p>
        <a
          href="/"
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 font-medium"
        >
          Back home
        </a>
      </div>
    );
  }

  // Join form — player is not yet in this game
  if (!isInGame) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Join the game
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Enter your name, then place yourself and guess your friends.
          </p>
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Your name"
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
              maxLength={50}
              autoFocus
            />
            <button
              type="submit"
              disabled={joining}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 font-medium disabled:opacity-60"
            >
              {joining ? "Joining…" : "Join"}
            </button>
            {joinError && (
              <p
                className="text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {joinError}
              </p>
            )}
          </form>
        </div>
      </div>
    );
  }

  // Player is in the game — show the dashboard
  return (
    <div className="min-h-screen py-10 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Friend Place
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {game.axis_x_label_low} ↔ {game.axis_x_label_high} &nbsp;|&nbsp;{" "}
          {game.axis_y_label_low} ↔ {game.axis_y_label_high}
        </p>
      </div>
      <GameDashboard
        game={game}
        currentPlayerId={currentPlayerId!}
        inviteCode={inviteCode}
      />
    </div>
  );
}
