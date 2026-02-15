"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";
import type { Database } from "@/lib/types/database";

type Game = Database["public"]["Tables"]["games"]["Row"];
type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];

interface GameWithRank {
  game: Game;
  inviteCode: string;
  myRank: number;
  totalPlayers: number;
  myDisplayName: string;
}

function getRankSuffix(n: number): string {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export default function GamesPage() {
  const { user, loading: authLoading, isLinked } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<GameWithRank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
      return;
    }
    if (!user || !isLinked) return;

    const run = async () => {
      const supabase = createClient();

      const { data: myGamesAsCreator } = await supabase
        .from("games")
        .select("id, invite_code, phase, created_at, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
        .eq("created_by", user.id)
        .eq("phase", "results");

      const { data: myGamePlayers } = await supabase
        .from("game_players")
        .select("game_id")
        .eq("player_id", user.id);

      const gameIds = new Set<string>();
      (myGamesAsCreator ?? []).forEach((g) => gameIds.add(g.id));
      (myGamePlayers ?? []).forEach((gp) => gameIds.add(gp.game_id));

      if (gameIds.size === 0) {
        setGames([]);
        setLoading(false);
        return;
      }

      const { data: allGames } = await supabase
        .from("games")
        .select("*")
        .in("id", Array.from(gameIds))
        .eq("phase", "results")
        .order("created_at", { ascending: false });

      const result: GameWithRank[] = [];

      for (const game of allGames ?? []) {
        const { data: players } = await supabase
          .from("game_players")
          .select("id, display_name, score, player_id")
          .eq("game_id", game.id)
          .not("score", "is", null);

        const sorted = (players ?? []).slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const myIndex = sorted.findIndex((p) => p.player_id === user.id);
        if (myIndex === -1) continue;
        const myRank = myIndex + 1;
        const myRow = sorted[myIndex];

        result.push({
          game: game as Game,
          inviteCode: game.invite_code,
          myRank,
          totalPlayers: sorted.length,
          myDisplayName: myRow.display_name,
        });
      }

      setGames(result);
      setLoading(false);
    };

    run();
  }, [user, authLoading, isLinked, router]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  if (!isLinked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-secondary">
          Sign in to see your game history.
        </p>
        <Link href="/" className="text-splash hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-foreground">
        My games
      </h1>
      <p className="mt-1 text-sm text-secondary">
        Rank history for finished games (no scores shown).
      </p>

      {loading ? (
        <p className="mt-8 text-secondary">Loading...</p>
      ) : games.length === 0 ? (
        <p className="mt-8 text-secondary">
          No finished games yet. Play a game and come back after it ends!
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {games.map(({ game, inviteCode, myRank, totalPlayers, myDisplayName }) => (
            <li key={game.id}>
              <Link
                href={`/play/${inviteCode}`}
                className="block rounded-xl border border-border bg-surface p-4 hover:bg-muted/50"
              >
                <div className="font-medium text-foreground">
                  {game.axis_x_label_low} vs {game.axis_x_label_high} ·{" "}
                  {game.axis_y_label_low} vs {game.axis_y_label_high}
                </div>
                <div className="mt-1 text-sm text-secondary">
                  You ({myDisplayName}): {myRank}
                  {getRankSuffix(myRank)} of {totalPlayers}
                </div>
                <div className="mt-1 text-xs text-secondary">
                  {new Date(game.created_at).toLocaleDateString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
