-- Optional phone (E.164) and notification preferences for players.
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN players.phone IS 'Optional E.164 phone number for SMS reminders.';
COMMENT ON COLUMN players.notifications_enabled IS 'If false, do not send game reminders (SMS or push).';

-- Track when a player has viewed game results (for "results reminder" notifications).
ALTER TABLE game_players
  ADD COLUMN IF NOT EXISTS results_viewed_at timestamptz;

COMMENT ON COLUMN game_players.results_viewed_at IS 'When this player first viewed the results; null means reminder may be sent.';

-- Deduplicate and audit notifications (one per player per game per kind).
CREATE TABLE IF NOT EXISTS notification_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id     uuid REFERENCES games(id) ON DELETE SET NULL,
  kind        text NOT NULL,
  channel     text NOT NULL,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  message     text,
  UNIQUE(player_id, game_id, kind)
);

COMMENT ON TABLE notification_log IS 'Log of sent notifications (mid_game_nudge, new_game_invite, results_reminder) for deduplication and auditing.';
COMMENT ON COLUMN notification_log.kind IS 'mid_game_nudge | new_game_invite | results_reminder';
COMMENT ON COLUMN notification_log.channel IS 'sms | push';

-- Only edge functions (service role) should read/write notification_log
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated cannot access; service role bypasses RLS
