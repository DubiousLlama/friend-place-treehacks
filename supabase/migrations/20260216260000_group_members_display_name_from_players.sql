-- Single source of truth for group member display name: use players.display_name.
-- group_members no longer stores display_name for linked members; only anonymous_display_name when player_id IS NULL.

ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS anonymous_display_name text;

-- Backfill: keep existing display_name for anonymous members only
UPDATE group_members
SET anonymous_display_name = display_name
WHERE player_id IS NULL AND display_name IS NOT NULL;

ALTER TABLE group_members
  DROP COLUMN IF EXISTS display_name;

COMMENT ON COLUMN group_members.anonymous_display_name IS 'Display label only when player_id IS NULL (anonymous member). When player_id is set, use players.display_name.';
