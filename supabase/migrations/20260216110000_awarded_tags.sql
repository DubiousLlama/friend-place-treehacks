-- =============================================
-- Awarded tags: track auto-awarded vs user-pinned
-- =============================================

ALTER TABLE user_featured_tags
  ADD COLUMN IF NOT EXISTS awarded_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN user_featured_tags.awarded_at IS 'When set, tag was auto-awarded from game consensus; null = user added manually.';
