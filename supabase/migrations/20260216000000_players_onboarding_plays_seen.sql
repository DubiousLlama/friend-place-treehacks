-- Store how many times the user has seen onboarding popups (first two plays).
-- Used only for linked users; anonymous users use localStorage.
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS onboarding_plays_seen integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN players.onboarding_plays_seen IS 'Number of times user has seen placing-phase onboarding popups (0, 1, or 2). Used when is_anonymous = false; anonymous users use localStorage.';
