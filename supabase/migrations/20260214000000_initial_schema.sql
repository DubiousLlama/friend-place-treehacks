-- =============================================
-- Friend Place: Initial Schema (v2 — name-slot pattern)
-- =============================================

-- Enum for game phases (no lobby — games start in placing)
CREATE TYPE game_phase AS ENUM ('placing', 'results');

-- Players (maps 1:1 to Supabase auth.users via id)
CREATE TABLE players (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Games
CREATE TABLE games (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code               text UNIQUE NOT NULL,
  axis_x_label_low          text NOT NULL,
  axis_x_label_high         text NOT NULL,
  axis_y_label_low          text NOT NULL,
  axis_y_label_high         text NOT NULL,
  phase                     game_phase NOT NULL DEFAULT 'placing',
  created_by                uuid NOT NULL REFERENCES players(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  submissions_lock_at       timestamptz,
  end_early_when_complete   boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_games_invite_code ON games(invite_code);

-- Game-player join table (name-slot pattern)
-- player_id is NULL for unclaimed name slots pre-populated by the creator.
-- Once a real user claims the slot, player_id is set to their auth.uid().
CREATE TABLE game_players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id       uuid REFERENCES players(id) ON DELETE CASCADE,
  display_name    text NOT NULL,
  self_x          real,
  self_y          real,
  has_submitted   boolean NOT NULL DEFAULT false,
  score           real,
  claimed_at      timestamptz,
  UNIQUE(game_id, display_name)
);

-- Guesses (one per guesser-target pair per game)
-- References game_players(id) for both guesser and target,
-- since targets may be unclaimed name slots with no players row.
CREATE TABLE guesses (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id                   uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  guesser_game_player_id    uuid NOT NULL REFERENCES game_players(id),
  target_game_player_id     uuid NOT NULL REFERENCES game_players(id),
  guess_x                   real NOT NULL,
  guess_y                   real NOT NULL,
  UNIQUE(game_id, guesser_game_player_id, target_game_player_id)
);

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE guesses ENABLE ROW LEVEL SECURITY;

-- players: users can read all, insert/update only their own row
CREATE POLICY "Anyone can read players"
  ON players FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own player"
  ON players FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own player"
  ON players FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- games: anyone authenticated can read; authenticated can create (must be creator)
CREATE POLICY "Anyone can read games"
  ON games FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create games"
  ON games FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- game_players: read all; insert name slots (creator) or self-add; claim unclaimed or update own
CREATE POLICY "Read game players"
  ON game_players FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert name slots or add self"
  ON game_players FOR INSERT TO authenticated
  WITH CHECK (
    -- Creator inserting unclaimed name slots (player_id IS NULL)
    player_id IS NULL
    AND EXISTS (
      SELECT 1 FROM games WHERE games.id = game_id AND games.created_by = auth.uid()
    )
    -- OR any authenticated user adding themselves mid-game
    OR player_id = auth.uid()
  );

CREATE POLICY "Claim unclaimed slot or update own row"
  ON game_players FOR UPDATE TO authenticated
  USING (
    -- Can claim an unclaimed slot (player_id IS NULL currently)
    player_id IS NULL
    -- Or update a row you already own
    OR player_id = auth.uid()
  )
  WITH CHECK (
    -- After update, player_id must be your own uid (claiming) or unchanged
    player_id = auth.uid()
  );

-- guesses: insert/update own (via game_player ownership); read only in results phase
CREATE POLICY "Insert own guesses"
  ON guesses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.id = guesser_game_player_id
        AND game_players.player_id = auth.uid()
    )
  );

CREATE POLICY "Update own guesses"
  ON guesses FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.id = guesser_game_player_id
        AND game_players.player_id = auth.uid()
    )
  );

CREATE POLICY "Read guesses only in results phase"
  ON guesses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = guesses.game_id
        AND games.phase = 'results'
    )
  );

-- =============================================
-- Realtime
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_players;
