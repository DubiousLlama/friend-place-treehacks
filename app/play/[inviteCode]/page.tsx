"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NameSelector } from "@/components/NameSelector";
import { GameDashboard } from "@/components/GameDashboard";
import type { Database } from "@/lib/types/database";

type Game = Database["public"]["Tables"]["games"]["Row"];
type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];

export default function PlayPage() {
  const params = useParams();
  const inviteCode = params.inviteCode as string;
  const [game, setGame] = useState<Game | null>(null);
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchAll = useCallback(async () => {
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

    // Fetch game
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
    setGame(rawGame as Game);

    // Fetch game players
    const { data: players } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", (rawGame as Game).id)
      .order("claimed_at", { ascending: true, nullsFirst: false });

    if (players) setGamePlayers(players as GamePlayer[]);
    setLoading(false);
  }, [inviteCode, supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: game_players changes (claims, new players, placements)
  useEffect(() => {
    if (!game?.id) return;

    const channel = supabase
      .channel(`play-players-${game.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_players",
          filter: `game_id=eq.${game.id}`,
        },
        () => {
          supabase
            .from("game_players")
            .select("*")
            .eq("game_id", game.id)
            .order("claimed_at", { ascending: true, nullsFirst: false })
            .then(({ data }) => {
              if (data) setGamePlayers(data as GamePlayer[]);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id, supabase]);

  // Realtime: game phase changes
  useEffect(() => {
    if (!game?.id) return;

    const channel = supabase
      .channel(`play-game-${game.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${game.id}`,
        },
        (payload) => {
          setGame(payload.new as Game);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id, supabase]);

  // ---- Render states ----

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
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

  // Has the current user claimed a name slot?
  const mySlot = gamePlayers.find(
    (gp) => gp.player_id === currentPlayerId
  );

  // Not claimed yet — show NameSelector
  if (!mySlot) {
    return (
      <NameSelector
        gameId={game.id}
        gamePlayers={gamePlayers}
        currentPlayerId={currentPlayerId!}
        onClaimed={() => fetchAll()}
      />
    );
  }

  // Game is in results phase
  if (game.phase === "results") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-zinc-600 dark:text-zinc-400">
          Results — scoreboard and placement reveal. (Coming in Phase 5.)
        </p>
      </div>
    );
  }

  // Game is in placing phase — show dashboard
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
        gamePlayers={gamePlayers}
        mySlot={mySlot}
        currentPlayerId={currentPlayerId!}
        inviteCode={inviteCode}
      />
    </div>
  );
}
