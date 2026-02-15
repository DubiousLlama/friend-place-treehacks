-- =============================================
-- Account system: linked_at, saved groups
-- =============================================

-- Mark when a player linked a persistent identity (email/OAuth)
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS linked_at timestamptz;

-- Saved groups: "Play again with same crew"
CREATE TABLE saved_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_groups_owner ON saved_groups(owner_id);

CREATE TABLE saved_group_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES saved_groups(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  sort_order  smallint NOT NULL DEFAULT 0,
  UNIQUE(group_id, display_name)
);

CREATE INDEX idx_saved_group_members_group ON saved_group_members(group_id);

-- RLS: saved_groups
ALTER TABLE saved_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved groups"
  ON saved_groups FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own saved groups"
  ON saved_groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own saved groups"
  ON saved_groups FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own saved groups"
  ON saved_groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- RLS: saved_group_members (via group ownership)
ALTER TABLE saved_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read members of own groups"
  ON saved_group_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM saved_groups
      WHERE saved_groups.id = saved_group_members.group_id
        AND saved_groups.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert members in own groups"
  ON saved_group_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM saved_groups
      WHERE saved_groups.id = saved_group_members.group_id
        AND saved_groups.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update members in own groups"
  ON saved_group_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM saved_groups
      WHERE saved_groups.id = saved_group_members.group_id
        AND saved_groups.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete members in own groups"
  ON saved_group_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM saved_groups
      WHERE saved_groups.id = saved_group_members.group_id
        AND saved_groups.owner_id = auth.uid()
    )
  );
