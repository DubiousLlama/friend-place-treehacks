-- =============================================
-- Host can delete game
-- =============================================

-- Allow the game creator to delete the game (CASCADE will remove game_players, guesses, etc.).
CREATE POLICY "Creator can delete game"
  ON games FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Clean up orphaned email_invites when a game is deleted (no FK on email_invites.target_id).
CREATE OR REPLACE FUNCTION delete_game_email_invites()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM email_invites
  WHERE target_type = 'game' AND target_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_games_delete_clean_invites
  BEFORE DELETE ON games
  FOR EACH ROW
  EXECUTE FUNCTION delete_game_email_invites();
