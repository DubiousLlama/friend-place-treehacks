-- Reserve a game_players slot for each email invite (player_id NULL until they accept).
-- Add invited_email to link the slot to the invite; on accept we UPDATE the row instead of INSERT.

ALTER TABLE game_players
  ADD COLUMN IF NOT EXISTS invited_email text;

-- One reserved slot per invited email per game (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_players_reserved_email
  ON game_players (game_id, lower(invited_email))
  WHERE invited_email IS NOT NULL;

-- Allow multiple "Pending" display_name when player_id IS NULL (reserved slots)
ALTER TABLE game_players DROP CONSTRAINT IF EXISTS game_players_game_id_display_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS game_players_game_id_display_name_claimed_key
  ON game_players (game_id, display_name)
  WHERE player_id IS NOT NULL;
