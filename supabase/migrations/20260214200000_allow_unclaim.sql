-- =============================================
-- Allow users to unclaim their game_players slot
-- =============================================
-- The existing UPDATE policy requires player_id = auth.uid() after update,
-- which blocks setting player_id back to NULL (unclaiming).
-- Fix: allow the result to be NULL when the user is unclaiming their own row.

DROP POLICY IF EXISTS "Claim unclaimed slot or update own row" ON game_players;

CREATE POLICY "Claim unclaimed slot or update own row"
  ON game_players FOR UPDATE TO authenticated
  USING (
    -- Can claim an unclaimed slot (player_id IS NULL currently)
    player_id IS NULL
    -- Or update a row you already own
    OR player_id = auth.uid()
  )
  WITH CHECK (
    -- After update, player_id must be your own uid (claiming / updating)
    player_id = auth.uid()
    -- Or NULL (unclaiming your slot)
    OR player_id IS NULL
  );
