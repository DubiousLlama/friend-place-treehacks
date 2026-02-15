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

/** Piecewise scoring: red segment y = -2x + 1 and green segment y = -0.2x + 0.2. */
/** Distance at which we switch from red to green (intersection: 4/9). */
export const PIECEWISE_KINK = 4 / 9;
/** Bonus points when guess is within this distance of target. */
export const BEST_FRIEND_BONUS = 50;
/** Distance threshold for best friend bonus. */
export const BEST_FRIEND_RADIUS = 0.12;

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
 * Piecewise linear accuracy (0-1):
 * - Red segment (distance <= 4/9): y = -2x + 1
 * - Green segment (4/9 <= distance <= 1): y = -0.2x + 0.2
 * - Distance > 1: 0
 */
export function linearAccuracyFromDistance(dist: number): number {
  if (dist > 1) return 0;
  if (dist <= PIECEWISE_KINK) return Math.max(0, -2 * dist + 1);
  return Math.max(0, -0.2 * dist + 0.2);
}

/** Best friend bonus (BEST_FRIEND_BONUS) when distance <= BEST_FRIEND_RADIUS, else 0. */
export function getBestFriendBonus(dist: number): number {
  return dist <= BEST_FRIEND_RADIUS ? BEST_FRIEND_BONUS : 0;
}

/**
 * Accuracy score for a single guess (0-1) using the piecewise linear
 * (red segment -2x+1, green segment -0.2x+0.2).
 */
export function guessAccuracy(
  guessX: number,
  guessY: number,
  targetSelfX: number,
  targetSelfY: number,
): number {
  const dist = euclideanDistance(guessX, guessY, targetSelfX, targetSelfY);
  return linearAccuracyFromDistance(dist);
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

    const dist = euclideanDistance(
      guess.guess_x,
      guess.guess_y,
      targetSelf.x,
      targetSelf.y,
    );
    const accuracy = linearAccuracyFromDistance(dist);
    const guesserPoints = accuracy * MAX_GUESS_POINTS + getBestFriendBonus(dist);
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
