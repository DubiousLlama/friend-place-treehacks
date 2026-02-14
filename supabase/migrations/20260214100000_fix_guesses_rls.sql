-- =============================================
-- Fix guesses RLS policies
-- =============================================

-- 1. Add missing DELETE policy so users can remove their own guesses
CREATE POLICY "Delete own guesses"
  ON guesses FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.id = guesser_game_player_id
        AND game_players.player_id = auth.uid()
    )
  );

-- 2. Fix SELECT policy: users need to read their own guesses during placing
--    phase (for graph re-entry), not just during results.
DROP POLICY IF EXISTS "Read guesses only in results phase" ON guesses;

CREATE POLICY "Read own guesses or all in results"
  ON guesses FOR SELECT TO authenticated
  USING (
    -- Own guesses — needed during placing phase for re-entry
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.id = guesser_game_player_id
        AND game_players.player_id = auth.uid()
    )
    -- Or all guesses visible once game reaches results phase
    OR EXISTS (
      SELECT 1 FROM games
      WHERE games.id = guesses.game_id
        AND games.phase = 'results'
    )
  );

-- 3. Fix game_players INSERT: allow any user to add unclaimed slots
DROP POLICY IF EXISTS "Insert name slots or add self" ON game_players;

CREATE POLICY "Insert name slots or add self"
  ON game_players FOR INSERT TO authenticated
  WITH CHECK (
    player_id IS NULL
    OR player_id = auth.uid()
  );
