/**
 * Server-side scoring algorithm for Friend Place.
 *
 * Called when a game transitions to the "results" phase.
 * Computes per-player total scores from self-placements and guesses.
 */

import type { Database } from "@/lib/types/database";

type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];
type Guess = Database["public"]["Tables"]["guesses"]["Row"];

// ---------------------------------------------------------------------------
// Configurable constants
// ---------------------------------------------------------------------------

/** Maximum points a guesser can earn per correct guess (perfect placement). */
export const MAX_GUESS_POINTS = 100;

/**
 * Standard deviation for the Gaussian scoring falloff.
 *
 * Controls how quickly points drop with distance.  A smaller value
 * penalises mid-range guesses more aggressively.
 *
 * With σ = 0.25 on a 0-1 normalised board:
 *   d=0.0 → 100 pts, d=0.1 → 92 pts, d=0.2 → 73 pts,
 *   d=0.3 → 49 pts,  d=0.5 → 14 pts, d=0.7 → 2 pts
 */
export const GAUSS_SIGMA = 0.3;
export const HYPERGAUS_k = 4;
export const HYPERGAUS_SIGMA = 0.3;
export const HYPERGAUSS_WEIGHT = 0.15;
export const GAUSS_WEIGHT = 0.5;

/**
 * Fraction of guesser points the target receives: 1 / (numPlayers + 1).
 * Exported for client-side score breakdown (scoring-client.ts).
 */
export function getTargetBonusFraction(numPlayers: number): number {
  return 1 / (numPlayers);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Euclidean distance between two normalised 0-1 coordinates. */
export function euclideanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Accuracy score for a single guess (0-1) using a Gaussian falloff.
 *
 * accuracy = exp(-distance² / (2 * σ²))
 *
 * A perfect guess (distance = 0) returns 1.
 * Points drop steeply for moderate distances, rewarding precision.
 */
export function guessAccuracy(
  guessX: number,
  guessY: number,
  targetSelfX: number,
  targetSelfY: number,
): number {
  const dist = euclideanDistance(guessX, guessY, targetSelfX, targetSelfY);
  return (
    GAUSS_WEIGHT * Math.exp(-(dist * dist) / (2 * GAUSS_SIGMA * GAUSS_SIGMA)) +
    HYPERGAUSS_WEIGHT * Math.exp(-((dist / HYPERGAUS_SIGMA) ** HYPERGAUS_k))
  ) / (GAUSS_WEIGHT + HYPERGAUSS_WEIGHT);
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

export interface PlayerScore {
  gamePlayerId: string;
  totalScore: number;
}

/**
 * Compute total scores for all players in a game.
 *
 * @param gamePlayers - All game_players rows for this game.
 * @param guesses    - All guesses rows for this game.
 * @returns Array of { gamePlayerId, totalScore } for every claimed player.
 */
export function computeScores(
  gamePlayers: GamePlayer[],
  guesses: Guess[],
): PlayerScore[] {
  // Build a lookup: game_player.id → { self_x, self_y } (only for players with a self-placement)
  const selfPlacements = new Map<string, { x: number; y: number }>();
  for (const gp of gamePlayers) {
    if (gp.self_x != null && gp.self_y != null) {
      selfPlacements.set(gp.id, { x: gp.self_x, y: gp.self_y });
    }
  }

  // Accumulators: gamePlayerId → running total
  const scores = new Map<string, number>();
  let numPlayers = 0;
  for (const gp of gamePlayers) {
    if (gp.player_id != null) {
      scores.set(gp.id, 0);
      numPlayers++;
    }
  }

  /** Fraction of guesser points the target receives: 1 / (numPlayers + 1). */
  const targetFraction = 1 / (numPlayers + 1);

  for (const guess of guesses) {
    const targetSelf = selfPlacements.get(guess.target_game_player_id);
    if (!targetSelf) {
      // Target has no self-placement (unclaimed or didn't place) — 0 points
      continue;
    }

    const accuracy = guessAccuracy(
      guess.guess_x,
      guess.guess_y,
      targetSelf.x,
      targetSelf.y,
    );

    const guesserPoints = accuracy * MAX_GUESS_POINTS;
    const targetBonus = guesserPoints * targetFraction;

    // Add guesser points
    const currentGuesser = scores.get(guess.guesser_game_player_id) ?? 0;
    scores.set(guess.guesser_game_player_id, currentGuesser + guesserPoints);

    // Add target bonus
    const currentTarget = scores.get(guess.target_game_player_id) ?? 0;
    scores.set(guess.target_game_player_id, currentTarget + targetBonus);
  }

  // Build result array
  const result: PlayerScore[] = [];
  for (const [gamePlayerId, totalScore] of scores) {
    result.push({
      gamePlayerId,
      totalScore: Math.round(totalScore * 10) / 10, // round to 1 decimal
    });
  }

  return result;
}
