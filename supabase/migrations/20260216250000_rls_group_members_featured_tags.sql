-- Allow group members to read featured tags of other members in the same group
-- (so the group detail "Members" section can show each member's featured tags)
CREATE POLICY "Group members can read same-group featured tags"
  ON user_featured_tags FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM saved_groups sg
      WHERE (sg.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = sg.id AND gm.player_id = auth.uid()))
        AND (sg.owner_id = user_featured_tags.user_id OR EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = sg.id AND gm2.player_id = user_featured_tags.user_id))
    )
  );
