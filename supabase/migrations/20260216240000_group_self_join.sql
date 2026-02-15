-- Allow any authenticated user (including anonymous) to add themselves to a group (join by link).
-- Existing policy still allows owner/members to add others when permitted.

CREATE POLICY "Users can join any group as self"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (player_id = auth.uid());
