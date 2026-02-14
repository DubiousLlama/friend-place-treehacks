-- =============================================
-- Host controls: end game + placement counts
-- =============================================

-- 1. Add guesses_count to game_players so everyone can see
--    how many friends each player has placed (without reading
--    the actual guesses table, which is restricted by RLS).
ALTER TABLE game_players
  ADD COLUMN guesses_count integer NOT NULL DEFAULT 0;

-- 2. Allow the game creator to update the game (e.g. set phase to 'results').
CREATE POLICY "Creator can update game"
  ON games FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
