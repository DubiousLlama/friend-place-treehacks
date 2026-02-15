-- Group-level interests: any member can add/remove. Used as AI context for axis generation when creating a game with this group.

ALTER TABLE saved_groups
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN saved_groups.interests IS 'Short interest labels (e.g. coffee, hiking). Passed to AI when generating axes for a game created with this group.';
