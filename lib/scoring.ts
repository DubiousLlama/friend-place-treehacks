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

/** Fraction of guesser points awarded to the target as a bonus. */
export const TARGET_BONUS_FRACTION = 0.2;

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
 * Accuracy score for a single guess (0-1).
 * accuracy = max(0, 1 - distance)
 * A perfect guess (distance = 0) returns 1.
 * A guess with distance >= 1 returns 0.
 */
export function guessAccuracy(
  guessX: number,
  guessY: number,
  targetSelfX: number,
  targetSelfY: number,
): number {
  const dist = euclideanDistance(guessX, guessY, targetSelfX, targetSelfY);
  return Math.max(0, 1 - dist);
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
  for (const gp of gamePlayers) {
    if (gp.player_id != null) {
      scores.set(gp.id, 0);
    }
  }

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
    const targetBonus = guesserPoints * TARGET_BONUS_FRACTION;

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
