-- =============================================
-- Friend Place: Initial Schema
-- =============================================

-- Enum for game phases
CREATE TYPE game_phase AS ENUM ('lobby', 'placing', 'results');

-- Players (maps 1:1 to Supabase auth.users via id)
CREATE TABLE players (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Games
CREATE TABLE games (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code         text UNIQUE NOT NULL,
  axis_x_label_low    text NOT NULL,
  axis_x_label_high   text NOT NULL,
  axis_y_label_low    text NOT NULL,
  axis_y_label_high   text NOT NULL,
  phase               game_phase NOT NULL DEFAULT 'lobby',
  created_by          uuid NOT NULL REFERENCES players(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_games_invite_code ON games(invite_code);

-- Game-player join table
CREATE TABLE game_players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  display_name    text NOT NULL,
  self_x          real,
  self_y          real,
  has_submitted   boolean NOT NULL DEFAULT false,
  score           real,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

-- Guesses (one per guesser-target pair per game)
CREATE TABLE guesses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  guesser_id    uuid NOT NULL REFERENCES players(id),
  target_id     uuid NOT NULL REFERENCES players(id),
  guess_x       real NOT NULL,
  guess_y       real NOT NULL,
  UNIQUE(game_id, guesser_id, target_id)
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

-- game_players: can read players in any game; can insert self; can update own row
CREATE POLICY "Read game players"
  ON game_players FOR SELECT TO authenticated USING (true);

CREATE POLICY "Join a game"
  ON game_players FOR INSERT TO authenticated
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "Update own game player row"
  ON game_players FOR UPDATE TO authenticated
  USING (player_id = auth.uid());

-- guesses: can insert own; can only read when game is in results phase
CREATE POLICY "Insert own guesses"
  ON guesses FOR INSERT TO authenticated
  WITH CHECK (guesser_id = auth.uid());

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
