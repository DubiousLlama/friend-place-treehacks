import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeScores } from "@/lib/scoring";

/**
 * POST /api/games/[id]/check-end
 *
 * Checks whether a game should transition from "placing" to "results".
 * Three triggers:
 *   1. Early-end: all name slots claimed AND all claimed players submitted.
 *   2. Time-based: submissions_lock_at has passed.
 *   3. Force: request body includes { force: true } (host-initiated end).
 *
 * If any condition is met, scores are computed and the game phase is updated.
 * Uses the service-role (admin) client to bypass RLS.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: gameId } = await params;

  // Check for force flag in request body
  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch {
    // No body or invalid JSON — not forced
  }

  const supabase = createAdminClient();

  // 1. Fetch game
  const { data: game, error: gameErr } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (gameErr || !game) {
    return NextResponse.json(
      { error: "Game not found" },
      { status: 404 },
    );
  }

  // Already in results — nothing to do
  if (game.phase === "results") {
    return NextResponse.json({ ended: true, phase: "results" });
  }

  // 2. Fetch all game players
  const { data: gamePlayers } = await supabase
    .from("game_players")
    .select("*")
    .eq("game_id", gameId);

  if (!gamePlayers || gamePlayers.length === 0) {
    return NextResponse.json({ ended: false, phase: "placing" });
  }

  // 3. Check end conditions
  let shouldEnd = force;

  // 3a. Time-based: submissions_lock_at has passed
  if (!shouldEnd && game.submissions_lock_at) {
    const deadline = new Date(game.submissions_lock_at);
    if (deadline <= new Date()) {
      shouldEnd = true;
    }
  }

  // 3b. Early-end: all slots claimed AND all claimed players submitted
  if (!shouldEnd && game.end_early_when_complete) {
    const allClaimed = gamePlayers.every((gp) => gp.player_id !== null);
    const allSubmitted = gamePlayers
      .filter((gp) => gp.player_id !== null)
      .every((gp) => gp.has_submitted);

    if (allClaimed && allSubmitted) {
      shouldEnd = true;
    }
  }

  if (!shouldEnd) {
    return NextResponse.json({ ended: false, phase: "placing" });
  }

  // 4. Fetch all guesses for scoring
  const { data: guesses } = await supabase
    .from("guesses")
    .select("*")
    .eq("game_id", gameId);

  // 5. Compute scores
  const scores = computeScores(gamePlayers, guesses ?? []);

  // 6. Write scores to game_players
  for (const { gamePlayerId, totalScore } of scores) {
    await supabase
      .from("game_players")
      .update({ score: totalScore })
      .eq("id", gamePlayerId);
  }

  // 7. Transition game to results
  const { error: updateErr } = await supabase
    .from("games")
    .update({ phase: "results" as const })
    .eq("id", gameId);

  if (updateErr) {
    return NextResponse.json(
      { error: "Failed to update game phase" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ended: true, phase: "results" });
}
