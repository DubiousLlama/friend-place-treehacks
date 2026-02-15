-- =============================================
-- Groups as multi-user spaces, games.group_id, user_featured_tags
-- =============================================

-- 1. Games: link to group (optional)
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES saved_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_games_group_id ON games(group_id);

-- 2. Saved groups: group settings and daily game
ALTER TABLE saved_groups
  ADD COLUMN IF NOT EXISTS anyone_can_add_members boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS only_admin_can_remove boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_game_enabled boolean NOT NULL DEFAULT false;
-- Allow empty name (display as comma-separated member list)
ALTER TABLE saved_groups ALTER COLUMN name DROP NOT NULL;

-- 3. Group members (who is in the group; supports anonymous)
CREATE TABLE IF NOT EXISTS group_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES saved_groups(id) ON DELETE CASCADE,
  player_id    uuid REFERENCES players(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  sort_order   smallint NOT NULL DEFAULT 0,
  joined_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_player ON group_members(player_id);

-- 4. User featured tags (for profile and future prompts)
CREATE TABLE IF NOT EXISTS user_featured_tags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  label         text NOT NULL,
  agreement_pct smallint NOT NULL CHECK (agreement_pct >= 0 AND agreement_pct <= 100),
  game_id       uuid REFERENCES games(id) ON DELETE SET NULL,
  source_axis   text CHECK (source_axis IN ('x', 'y')),
  sort_order    smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_featured_tags_user ON user_featured_tags(user_id);

-- =============================================
-- RLS: saved_groups (extend for members)
-- =============================================

-- Members can read groups they belong to
CREATE POLICY "Members can read groups they belong to"
  ON saved_groups FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = saved_groups.id AND gm.player_id = auth.uid()
    )
  );

-- Any group member can update group (e.g. name)
CREATE POLICY "Members can update group"
  ON saved_groups FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = saved_groups.id AND gm.player_id = auth.uid()
    )
  );

-- Drop old owner-only SELECT/UPDATE so new policies apply (keep INSERT/DELETE owner-only)
DROP POLICY IF EXISTS "Users can read own saved groups" ON saved_groups;
DROP POLICY IF EXISTS "Users can update own saved groups" ON saved_groups;

-- =============================================
-- RLS: group_members
-- =============================================

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Read: if user is owner or in group_members
CREATE POLICY "Members can read group_members"
  ON group_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM saved_groups sg
      WHERE sg.id = group_members.group_id
        AND (sg.owner_id = auth.uid()
             OR EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = sg.id AND gm2.player_id = auth.uid()))
    )
  );

-- Insert: owner always; or any member if anyone_can_add_members
CREATE POLICY "Owner or members can add group_members"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM saved_groups sg
      WHERE sg.id = group_members.group_id
        AND (sg.owner_id = auth.uid()
             OR (sg.anyone_can_add_members AND EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = sg.id AND gm2.player_id = auth.uid())))
    )
  );

-- Update: owner or self (for sort_order/display_name)
CREATE POLICY "Owner or self can update group_members"
  ON group_members FOR UPDATE TO authenticated
  USING (
    player_id = auth.uid()
    OR EXISTS (SELECT 1 FROM saved_groups sg WHERE sg.id = group_members.group_id AND sg.owner_id = auth.uid())
  );

-- Delete: owner always; or any member if NOT only_admin_can_remove; or delete self (leave)
CREATE POLICY "Owner or permitted members can remove or leave"
  ON group_members FOR DELETE TO authenticated
  USING (
    player_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM saved_groups sg
      WHERE sg.id = group_members.group_id
        AND (sg.owner_id = auth.uid()
             OR (NOT sg.only_admin_can_remove AND EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = sg.id AND gm2.player_id = auth.uid())))
    )
  );

-- =============================================
-- RLS: user_featured_tags
-- =============================================

ALTER TABLE user_featured_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own featured tags"
  ON user_featured_tags FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own featured tags"
  ON user_featured_tags FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own featured tags"
  ON user_featured_tags FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own featured tags"
  ON user_featured_tags FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- Backfill group_members from existing saved_groups (only when table is empty)
-- =============================================

-- For each saved_group: add owner as first group_member (skip if group_members already has rows)
INSERT INTO group_members (group_id, player_id, display_name, is_anonymous, sort_order, joined_at)
SELECT sg.id, sg.owner_id, COALESCE(p.display_name, 'Member'), false, 0, sg.created_at
FROM saved_groups sg
LEFT JOIN players p ON p.id = sg.owner_id
WHERE (SELECT count(*) FROM group_members) = 0;

-- Add each saved_group_member as anonymous member (only if saved_group_members table still exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saved_group_members') THEN
    INSERT INTO group_members (group_id, player_id, display_name, is_anonymous, sort_order, joined_at)
    SELECT sgm.group_id, NULL, sgm.display_name, true, sgm.sort_order + 1, now()
    FROM saved_group_members sgm
    JOIN saved_groups sg ON sg.id = sgm.group_id
    LEFT JOIN players p ON p.id = sg.owner_id
    WHERE (p.display_name IS NULL OR sgm.display_name <> p.display_name);
  END IF;
END $$;
