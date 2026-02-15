-- =============================================
-- RPC: check_and_end_game
--
-- A SECURITY DEFINER function that checks whether a game should
-- transition from "placing" to "results". If so, it computes scores
-- and updates the game phase — all within a single privileged call.
--
-- This eliminates the need for a service-role key on the server.
-- The function runs with the DB owner's privileges, but validates
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
  v_score_record record;
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

  -- 5. Compute and write scores
  FOR v_score_record IN
    WITH self_placements AS (
      SELECT id, self_x, self_y
      FROM game_players
      WHERE game_id = p_game_id
        AND self_x IS NOT NULL
        AND self_y IS NOT NULL
    ),
    guess_scores AS (
      SELECT
        g.guesser_game_player_id,
        g.target_game_player_id,
        GREATEST(0, 1.0 - sqrt(
          power(g.guess_x - sp.self_x, 2) + power(g.guess_y - sp.self_y, 2)
        )) * 100.0 AS guesser_points
      FROM guesses g
      JOIN self_placements sp ON sp.id = g.target_game_player_id
      WHERE g.game_id = p_game_id
    ),
    player_scores AS (
      -- Guesser points
      SELECT guesser_game_player_id AS gp_id, SUM(guesser_points) AS pts
      FROM guess_scores
      GROUP BY guesser_game_player_id
      UNION ALL
      -- Target bonus (20% of guesser points)
      SELECT target_game_player_id AS gp_id, SUM(guesser_points * 0.2) AS pts
      FROM guess_scores
      GROUP BY target_game_player_id
    ),
    final_scores AS (
      SELECT gp_id, round(SUM(pts)::numeric, 1) AS total_score
      FROM player_scores
      GROUP BY gp_id
    )
    SELECT gp_id, total_score FROM final_scores
  LOOP
    UPDATE game_players
    SET score = v_score_record.total_score
    WHERE id = v_score_record.gp_id;
  END LOOP;

  -- 6. Transition game to results
  UPDATE games SET phase = 'results' WHERE id = p_game_id;

  RETURN jsonb_build_object('ended', true, 'phase', 'results');
END;
$$;

-- Grant execute to authenticated users (anon sessions included)
GRANT EXECUTE ON FUNCTION check_and_end_game(uuid, boolean) TO authenticated;
