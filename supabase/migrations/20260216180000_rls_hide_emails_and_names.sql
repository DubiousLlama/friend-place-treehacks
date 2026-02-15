-- =============================================
-- RLS: Ensure user emails & names are not readable by other clients
-- =============================================
-- 1. players: only allow reading your own row (no global list of display_name).
-- 2. game_players: only allow reading rows for games you're in (creator or player).
-- 3. email_invites: remove SELECT for authenticated so clients never see raw emails.
--    Use server APIs that return masked invites instead.
-- =============================================

-- 1. players: restrict to own row only
DROP POLICY IF EXISTS "Anyone can read players" ON players;
CREATE POLICY "Users can read own player"
  ON players FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 2. game_players: restrict to games you participate in
DROP POLICY IF EXISTS "Read game players" ON game_players;
CREATE POLICY "Read game players in my games"
  ON game_players FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = game_players.game_id
        AND (g.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM game_players gp
               WHERE gp.game_id = g.id AND gp.player_id = auth.uid()
             ))
    )
  );

-- 3. email_invites: remove client SELECT so emails are never exposed
--    Clients get invite list (with masked email) via GET /api/groups/[id]/invites and /api/games/[id]/invites
DROP POLICY IF EXISTS "Group members can read group invites" ON email_invites;
DROP POLICY IF EXISTS "Game members can read game invites" ON email_invites;
