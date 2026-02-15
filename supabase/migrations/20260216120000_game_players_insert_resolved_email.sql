-- Allow game creator to insert game_players rows with player_id set to another user (resolved email).
-- Previously only (player_id = auth.uid()) or (player_id IS NULL and creator) was allowed.

DROP POLICY IF EXISTS "Insert game player" ON game_players;

CREATE POLICY "Insert game player"
  ON game_players FOR INSERT TO authenticated
  WITH CHECK (
    -- Any user can insert a row claiming themselves (mid-game join)
    player_id = auth.uid()
    OR
    -- Game creator can insert any row for their game (name slots or resolved-email players)
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = game_players.game_id
        AND games.created_by = auth.uid()
    )
  );
