-- Let inviter set a temporary display name for email-invited users (shown when they claim).
ALTER TABLE email_invites
  ADD COLUMN IF NOT EXISTS suggested_display_name text;
