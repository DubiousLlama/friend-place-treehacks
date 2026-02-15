"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";
import type { Database } from "@/lib/types/database";

type Game = Database["public"]["Tables"]["games"]["Row"];
type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];
type Guess = Database["public"]["Tables"]["guesses"]["Row"];

interface ConsensusResult {
  gameId: string;
  inviteCode: string;
  axesLabel: string;
  variance: number;
  guessCount: number;
  selfX: number;
  selfY: number;
  meanGuessX: number;
  meanGuessY: number;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

export default function ProfilePage() {
  const { user, loading: authLoading, isLinked } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [consensusHighlights, setConsensusHighlights] = useState<ConsensusResult[]>([]);
  const [gamesCount, setGamesCount] = useState(0);
  const [bestRank, setBestRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
      return;
    }
    if (!user || !isLinked) return;

    const run = async () => {
      const supabase = createClient();

      const { data: player } = await supabase
        .from("players")
        .select("display_name")
        .eq("id", user.id)
        .single();
      setDisplayName(player?.display_name ?? null);

      const { data: mySlots } = await supabase
        .from("game_players")
        .select("id, game_id, display_name, self_x, self_y")
        .eq("player_id", user.id);

      const gameIds = [...new Set((mySlots ?? []).map((s) => s.game_id))];
      const { data: gamesData } = await supabase
        .from("games")
        .select("id, invite_code, phase, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
        .in("id", gameIds)
        .eq("phase", "results");

      const gamesMap = new Map((gamesData ?? []).map((g) => [g.id, g]));
      let bestRankSoFar: number | null = null;
      const consensusList: ConsensusResult[] = [];

      for (const slot of mySlots ?? []) {
        const game = gamesMap.get(slot.game_id);
        if (!game || slot.self_x == null || slot.self_y == null) continue;

        const { data: guessesForMe } = await supabase
          .from("guesses")
          .select("guess_x, guess_y")
          .eq("target_game_player_id", slot.id);

        const allPlayersInGame = await supabase
          .from("game_players")
          .select("id, score")
          .eq("game_id", slot.game_id)
          .not("score", "is", null);

        const sorted = (allPlayersInGame.data ?? []).slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const myIdx = sorted.findIndex((p) => p.id === slot.id);
        if (myIdx >= 0) {
          const rank = myIdx + 1;
          if (bestRankSoFar === null || rank < bestRankSoFar) bestRankSoFar = rank;
        }

        if ((guessesForMe?.length ?? 0) >= 2) {
          const xs = guessesForMe!.map((g) => g.guess_x);
          const ys = guessesForMe!.map((g) => g.guess_y);
          const vx = variance(xs);
          const vy = variance(ys);
          const totalVariance = vx + vy;
          const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
          const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
          consensusList.push({
            gameId: game.id,
            inviteCode: game.invite_code,
            axesLabel: `${game.axis_x_label_low}–${game.axis_x_label_high} / ${game.axis_y_label_low}–${game.axis_y_label_high}`,
            variance: totalVariance,
            guessCount: guessesForMe!.length,
            selfX: slot.self_x,
            selfY: slot.self_y,
            meanGuessX: meanX,
            meanGuessY: meanY,
          });
        }
      }

      consensusList.sort((a, b) => a.variance - b.variance);
      setConsensusHighlights(consensusList.slice(0, 5));
      setGamesCount(gameIds.length);
      setBestRank(bestRankSoFar);
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
          Sign in to see your profile.
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
        Profile
      </h1>
      <p className="mt-1 text-sm text-secondary">
        {displayName ?? user.email ?? "Signed in"}
      </p>

      {loading ? (
        <p className="mt-8 text-secondary">Loading...</p>
      ) : (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Stats
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-secondary">
              <li>Games played (finished): {gamesCount}</li>
              {bestRank != null && (
                <li>Best rank: {bestRank === 1 ? "1st" : bestRank === 2 ? "2nd" : bestRank === 3 ? "3rd" : `${bestRank}th`}</li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Extreme consensus
            </h2>
            <p className="mt-1 text-sm text-secondary">
              Games where your friends agreed most about where you’d place yourself (low variance in their guesses).
            </p>
            {consensusHighlights.length === 0 ? (
              <p className="mt-4 text-sm text-secondary">
                Play more games with at least 2 friends guessing you to see highlights.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {consensusHighlights.map((c) => (
                  <li key={c.gameId}>
                    <Link
                      href={`/play/${c.inviteCode}`}
                      className="block rounded-xl border border-border bg-surface p-3 hover:bg-muted/50"
                    >
                      <div className="text-sm font-medium text-foreground">
                        {c.axesLabel}
                      </div>
                      <div className="mt-1 text-xs text-secondary">
                        {c.guessCount} friends guessed you · very similar placements
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
