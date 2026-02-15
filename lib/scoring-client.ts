/**
 * Client-side per-guess score breakdown for the results visualization.
 *
 * Reuses the same formula as lib/scoring.ts but produces detailed per-guess
 * breakdowns so the UI can show point labels on individual placements.
 *
 * All position data is available client-side once the game reaches "results"
 * phase (guesses RLS opens up in results).
 */

import type { GamePlayer, Guess } from "@/lib/game-types";
import {
  guessAccuracy,
  euclideanDistance,
  MAX_GUESS_POINTS,
  getTargetBonusFraction,
} from "@/lib/scoring";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Score details for a single guess. */
export interface GuessScoreDetail {
  guessId: string;
  guesserId: string;
  targetId: string;
  guesserPoints: number;
  targetBonus: number;
  accuracy: number;
  distance: number;
}

/** Full score breakdown for a single player. */
export interface PlayerScoreBreakdown {
  gamePlayerId: string;
  displayName: string;
  /** Points earned from guessing others. */
  guessPoints: number;
  /** Bonus points earned from others guessing this player accurately. */
  bonusPoints: number;
  /** Total score (guessPoints + bonusPoints). */
  totalScore: number;
  /** Detail of each guess this player made. */
  guessDetails: GuessScoreDetail[];
  /** Detail of each guess others made targeting this player. */
  bonusDetails: GuessScoreDetail[];
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Compute detailed per-guess score breakdowns for all players.
 *
 * @param gamePlayers - All game_players rows for this game.
 * @param guesses    - All guesses rows for this game.
 * @returns Map from game_player ID to their full score breakdown.
 */
export function computeScoreBreakdowns(
  gamePlayers: GamePlayer[],
  guesses: Guess[],
): Map<string, PlayerScoreBreakdown> {
  // Build self-placement lookup
  const selfPlacements = new Map<string, { x: number; y: number }>();
  for (const gp of gamePlayers) {
    if (gp.self_x != null && gp.self_y != null) {
      selfPlacements.set(gp.id, { x: gp.self_x, y: gp.self_y });
    }
  }

  // Display name lookup
  const displayNames = new Map<string, string>();
  for (const gp of gamePlayers) {
    displayNames.set(gp.id, gp.display_name);
  }

  // Initialize breakdowns for all claimed players
  const breakdowns = new Map<string, PlayerScoreBreakdown>();
  let numPlayers = 0;
  for (const gp of gamePlayers) {
    if (gp.player_id != null) {
      breakdowns.set(gp.id, {
        gamePlayerId: gp.id,
        displayName: gp.display_name,
        guessPoints: 0,
        bonusPoints: 0,
        totalScore: 0,
        guessDetails: [],
        bonusDetails: [],
      });
      numPlayers++;
    }
  }
  const targetFraction = getTargetBonusFraction(numPlayers);

  // Process each guess
  for (const guess of guesses) {
    const targetSelf = selfPlacements.get(guess.target_game_player_id);
    if (!targetSelf) continue; // No self-placement to score against

    const accuracy = guessAccuracy(
      guess.guess_x,
      guess.guess_y,
      targetSelf.x,
      targetSelf.y,
    );
    const distance = euclideanDistance(
      guess.guess_x,
      guess.guess_y,
      targetSelf.x,
      targetSelf.y,
    );
    const guesserPoints = accuracy * MAX_GUESS_POINTS;
    const targetBonus = guesserPoints * targetFraction;

    const detail: GuessScoreDetail = {
      guessId: guess.id,
      guesserId: guess.guesser_game_player_id,
      targetId: guess.target_game_player_id,
      guesserPoints: Math.round(guesserPoints * 10) / 10,
      targetBonus: Math.round(targetBonus * 10) / 10,
      accuracy,
      distance,
    };

    // Add to guesser's breakdown
    const guesser = breakdowns.get(guess.guesser_game_player_id);
    if (guesser) {
      guesser.guessPoints += guesserPoints;
      guesser.guessDetails.push(detail);
    }

    // Add to target's breakdown
    const target = breakdowns.get(guess.target_game_player_id);
    if (target) {
      target.bonusPoints += targetBonus;
      target.bonusDetails.push(detail);
    }
  }

  // Finalize totals
  for (const b of breakdowns.values()) {
    b.guessPoints = Math.round(b.guessPoints * 10) / 10;
    b.bonusPoints = Math.round(b.bonusPoints * 10) / 10;
    b.totalScore = Math.round((b.guessPoints + b.bonusPoints) * 10) / 10;
  }

  return breakdowns;
}

/**
 * Compute the all-guesses detail list (flat) — useful for rendering
 * all guess lines / dots on the graph.
 */
export function computeAllGuessDetails(
  gamePlayers: GamePlayer[],
  guesses: Guess[],
): GuessScoreDetail[] {
  const selfPlacements = new Map<string, { x: number; y: number }>();
  let numPlayers = 0;
  for (const gp of gamePlayers) {
    if (gp.self_x != null && gp.self_y != null) {
      selfPlacements.set(gp.id, { x: gp.self_x, y: gp.self_y });
    }
    if (gp.player_id != null) numPlayers++;
  }
  const targetFraction = getTargetBonusFraction(numPlayers);

  const details: GuessScoreDetail[] = [];

  for (const guess of guesses) {
    const targetSelf = selfPlacements.get(guess.target_game_player_id);
    if (!targetSelf) continue;

    const accuracy = guessAccuracy(
      guess.guess_x,
      guess.guess_y,
      targetSelf.x,
      targetSelf.y,
    );
    const distance = euclideanDistance(
      guess.guess_x,
      guess.guess_y,
      targetSelf.x,
      targetSelf.y,
    );
    const guesserPoints = accuracy * MAX_GUESS_POINTS;
    const targetBonus = guesserPoints * targetFraction;

    details.push({
      guessId: guess.id,
      guesserId: guess.guesser_game_player_id,
      targetId: guess.target_game_player_id,
      guesserPoints: Math.round(guesserPoints * 10) / 10,
      targetBonus: Math.round(targetBonus * 10) / 10,
      accuracy,
      distance,
    });
  }

  return details;
}
