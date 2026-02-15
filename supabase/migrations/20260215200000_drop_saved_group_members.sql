-- =============================================
-- Remove saved_group_members; app uses only group_members
-- =============================================

DROP POLICY IF EXISTS "Users can read members of own groups" ON saved_group_members;
DROP POLICY IF EXISTS "Users can insert members in own groups" ON saved_group_members;
DROP POLICY IF EXISTS "Users can update members in own groups" ON saved_group_members;
DROP POLICY IF EXISTS "Users can delete members in own groups" ON saved_group_members;

DROP TABLE IF EXISTS saved_group_members;
