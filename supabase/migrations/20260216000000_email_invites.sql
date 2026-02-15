-- =============================================
-- Email invites: invite by email for groups and games
-- =============================================

CREATE TABLE email_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  text NOT NULL CHECK (target_type IN ('group', 'game')),
  target_id    uuid NOT NULL,
  email        text NOT NULL,
  token        text UNIQUE NOT NULL,
  invited_by   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

-- target_id references saved_groups(id) or games(id) depending on target_type (no FK for polymorphic)
CREATE INDEX idx_email_invites_target ON email_invites(target_type, target_id);
CREATE UNIQUE INDEX idx_email_invites_token ON email_invites(token);
CREATE UNIQUE INDEX idx_email_invites_pending ON email_invites(LOWER(email), target_type, target_id);

-- =============================================
-- RLS: email_invites
-- =============================================

ALTER TABLE email_invites ENABLE ROW LEVEL SECURITY;

-- SELECT: group members can see invites for their group; game creator or game_players can see invites for that game
CREATE POLICY "Group members can read group invites"
  ON email_invites FOR SELECT TO authenticated
  USING (
    target_type = 'group'
    AND (
      EXISTS (
        SELECT 1 FROM saved_groups sg
        WHERE sg.id = email_invites.target_id
          AND (sg.owner_id = auth.uid()
               OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = sg.id AND gm.player_id = auth.uid()))
      )
    )
  );

CREATE POLICY "Game members can read game invites"
  ON email_invites FOR SELECT TO authenticated
  USING (
    target_type = 'game'
    AND (
      EXISTS (
        SELECT 1 FROM games g
        WHERE g.id = email_invites.target_id AND g.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM game_players gp
        WHERE gp.game_id = email_invites.target_id AND gp.player_id = auth.uid()
      )
    )
  );

-- INSERT: same as group_members / game: group members with add permission; game creator
CREATE POLICY "Group members can insert group invites"
  ON email_invites FOR INSERT TO authenticated
  WITH CHECK (
    target_type = 'group'
    AND invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM saved_groups sg
      WHERE sg.id = email_invites.target_id
        AND (sg.owner_id = auth.uid()
             OR (sg.anyone_can_add_members AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = sg.id AND gm.player_id = auth.uid())))
    )
  );

CREATE POLICY "Game creator can insert game invites"
  ON email_invites FOR INSERT TO authenticated
  WITH CHECK (
    target_type = 'game'
    AND invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = email_invites.target_id AND g.created_by = auth.uid()
    )
  );

-- DELETE: inviter can cancel; accept flow uses service role
CREATE POLICY "Inviter can delete own invites"
  ON email_invites FOR DELETE TO authenticated
  USING (invited_by = auth.uid());
