-- Device daily usage: one row per device per calendar day for rate limiting.
-- Used for axes generation (10/day) and invite emails (20/day).
-- Access via service-role only; no RLS policies for public/authenticated.

CREATE TABLE IF NOT EXISTS device_daily_usage (
  device_key           text        NOT NULL,
  date                 date        NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  axes_generation_count int         NOT NULL DEFAULT 0,
  invite_email_count    int         NOT NULL DEFAULT 0,
  user_agent           text,
  ip_address           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_key, date)
);

-- Index for cleanup cron: delete rows where date < today - N
CREATE INDEX IF NOT EXISTS device_daily_usage_date_idx ON device_daily_usage (date);

-- No RLS: table is accessed only by API routes using service-role.
ALTER TABLE device_daily_usage ENABLE ROW LEVEL SECURITY;

-- No policies: no role can read/write via RLS; service role bypasses RLS.
-- This keeps the table server-only.

-- Atomic increment for axes (used by suggest-axes route).
CREATE OR REPLACE FUNCTION increment_device_axes(p_device_key text, p_date date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE device_daily_usage
  SET axes_generation_count = axes_generation_count + 1,
      updated_at = now()
  WHERE device_key = p_device_key AND date = p_date;
$$;

-- Atomic increment for invite emails (used by invite-by-email routes).
CREATE OR REPLACE FUNCTION increment_device_invites(p_device_key text, p_date date, p_count int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE device_daily_usage
  SET invite_email_count = invite_email_count + p_count,
      updated_at = now()
  WHERE device_key = p_device_key AND date = p_date;
$$;
