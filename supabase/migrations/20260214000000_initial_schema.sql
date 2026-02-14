-- =============================================
-- Friend Place: Initial Schema
-- =============================================

-- Enum for game phases (no lobby — games start in "placing" immediately)
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
  submissions_lock_at       timestamptz NOT NULL,
  end_early_when_complete   boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_games_invite_code ON games(invite_code);

-- Game-player join table (supports pre-created "name slots" with nullable player_id)
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
-- References game_players(id) instead of players(id) since targets may be unclaimed name slots
CREATE TABLE guesses (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id                   uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  guesser_game_player_id    uuid NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  target_game_player_id     uuid NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
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

-- games: anyone authenticated can read; authenticated can create
CREATE POLICY "Anyone can read games"
  ON games FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create games"
  ON games FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- game_players: read all; insert name slots (creator) or self (mid-game join); update own or claim unclaimed
CREATE POLICY "Read game players"
  ON game_players FOR SELECT TO authenticated USING (true);

-- Creator can insert name slots (player_id IS NULL) for games they created,
-- OR any authenticated user can insert a row claiming themselves (player_id = auth.uid())
CREATE POLICY "Insert game player"
  ON game_players FOR INSERT TO authenticated
  WITH CHECK (
    player_id = auth.uid()
    OR (
      player_id IS NULL
      AND EXISTS (
        SELECT 1 FROM games
        WHERE games.id = game_players.game_id
          AND games.created_by = auth.uid()
      )
    )
  );

-- Players can update their own claimed row (player_id = auth.uid()),
-- OR claim an unclaimed row (player_id IS NULL -> set to auth.uid())
CREATE POLICY "Update game player"
  ON game_players FOR UPDATE TO authenticated
  USING (
    player_id = auth.uid()
    OR player_id IS NULL
  )
  WITH CHECK (
    player_id = auth.uid()
  );

-- guesses: can insert/update own; can only read when game is in results phase
CREATE POLICY "Insert own guesses"
  ON guesses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.id = guesses.guesser_game_player_id
        AND game_players.player_id = auth.uid()
    )
  );

CREATE POLICY "Update own guesses"
  ON guesses FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.id = guesses.guesser_game_player_id
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
