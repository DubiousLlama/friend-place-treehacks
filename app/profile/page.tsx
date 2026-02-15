"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";

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

interface GameRankEntry {
  gameId: string;
  inviteCode: string;
  axesLabel: string;
  createdAt: string;
  myRank: number;
  totalPlayers: number;
}

function getRankSuffix(n: number): string {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
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
  const [scoreHistory, setScoreHistory] = useState<GameRankEntry[]>([]);
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
        .select("id, invite_code, phase, created_at, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
        .in("id", gameIds)
        .eq("phase", "results")
        .order("created_at", { ascending: false });

      const gamesMap = new Map((gamesData ?? []).map((g) => [g.id, g]));
      let bestRankSoFar: number | null = null;
      const consensusList: ConsensusResult[] = [];
      const rankHistoryList: GameRankEntry[] = [];

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
          rankHistoryList.push({
            gameId: game.id,
            inviteCode: game.invite_code,
            axesLabel: `${game.axis_x_label_low}–${game.axis_x_label_high} / ${game.axis_y_label_low}–${game.axis_y_label_high}`,
            createdAt: game.created_at,
            myRank: rank,
            totalPlayers: sorted.length,
          });
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
      // Dedupe by game and sort by date (newest first)
      const byGame = new Map(rankHistoryList.map((r) => [r.gameId, r]));
      const sorted = Array.from(byGame.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setScoreHistory(sorted.slice(0, 10));
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
        Account
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
              Score history
            </h2>
            <p className="mt-1 text-sm text-secondary">
              View your games by rank (no scores). See how you placed in each finished game.
            </p>
            {scoreHistory.length === 0 ? (
              <p className="mt-4 text-sm text-secondary">
                No finished games yet. Play a game and come back after it ends!
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {scoreHistory.slice(0, 5).map((entry) => (
                  <li key={entry.gameId}>
                    <Link
                      href={`/play/${entry.inviteCode}`}
                      className="block rounded-xl border border-border bg-surface p-3 hover:bg-muted/50"
                    >
                      <div className="text-sm font-medium text-foreground">
                        {entry.axesLabel}
                      </div>
                      <div className="mt-1 text-xs text-secondary">
                        You placed {entry.myRank}
                        {getRankSuffix(entry.myRank)} of {entry.totalPlayers} ·{" "}
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/games"
              className="mt-3 inline-block text-sm font-medium text-splash hover:underline"
            >
              View all games →
            </Link>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Profile records
            </h2>
            <p className="mt-1 text-sm text-secondary">
              Interesting results from your games—e.g. where your friends had strong consensus about you.
            </p>

            <h3 className="mt-4 font-display text-sm font-semibold text-foreground">
              Extreme consensus
            </h3>
            <p className="mt-0.5 text-sm text-secondary">
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
            <p className="mt-4 text-xs text-secondary italic">
              More profile record types (e.g. biggest surprises, trends) can be added here later.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
