-- =============================================
-- Soft delete games: mark as deleted instead of removing rows.
-- Deleted games are hidden from reads and not shown on profile or elsewhere.
-- =============================================

-- 1. Add deleted_at (NULL = not deleted)
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Hide deleted games from all reads
DROP POLICY IF EXISTS "Anyone can read games" ON games;
CREATE POLICY "Anyone can read non-deleted games"
  ON games FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- 3. Remove hard-delete path: drop policy and trigger/function
DROP POLICY IF EXISTS "Creator can delete game" ON games;
DROP TRIGGER IF EXISTS on_games_delete_clean_invites ON games;
DROP FUNCTION IF EXISTS delete_game_email_invites();
