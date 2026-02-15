-- =============================================
-- RPC: check_and_end_game
--
-- A SECURITY DEFINER function that checks whether a game should
-- transition from "placing" to "results". If so, it updates the
-- game phase only. Scores are computed client-side from lib/scoring
-- so the scoring logic remains a single, easily modifiable source of truth.
--
-- The function runs with the DB owner's privileges and validates
-- that only the game creator can force-end.
-- =============================================

CREATE OR REPLACE FUNCTION check_and_end_game(
  p_game_id uuid,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_should_end boolean := false;
  v_all_claimed boolean;
  v_all_submitted boolean;
BEGIN
  -- 1. Fetch game
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Game not found');
  END IF;

  -- Already in results — nothing to do
  IF v_game.phase = 'results' THEN
    RETURN jsonb_build_object('ended', true, 'phase', 'results');
  END IF;

  -- 2. Force-end (only the game creator may force)
  IF p_force AND v_game.created_by = auth.uid() THEN
    v_should_end := true;
  END IF;

  -- 3. Time-based: submissions_lock_at has passed
  IF NOT v_should_end AND v_game.submissions_lock_at IS NOT NULL THEN
    IF v_game.submissions_lock_at <= now() THEN
      v_should_end := true;
    END IF;
  END IF;

  -- 4. Early-end: all slots claimed AND all claimed players submitted
  IF NOT v_should_end AND v_game.end_early_when_complete THEN
    SELECT
      COALESCE(bool_and(player_id IS NOT NULL), false),
      COALESCE(bool_and(has_submitted) FILTER (WHERE player_id IS NOT NULL), false)
    INTO v_all_claimed, v_all_submitted
    FROM game_players
    WHERE game_id = p_game_id;

    IF v_all_claimed AND v_all_submitted THEN
      v_should_end := true;
    END IF;
  END IF;

  IF NOT v_should_end THEN
    RETURN jsonb_build_object('ended', false, 'phase', 'placing');
  END IF;

  -- 5. Transition game to results (scores are computed client-side from lib/scoring)
  UPDATE games SET phase = 'results' WHERE id = p_game_id;

  RETURN jsonb_build_object('ended', true, 'phase', 'results');
END;
$$;

-- Grant execute to authenticated users (anon sessions included)
GRANT EXECUTE ON FUNCTION check_and_end_game(uuid, boolean) TO authenticated;
