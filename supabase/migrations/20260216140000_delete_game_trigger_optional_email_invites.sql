-- =============================================
-- Fix: allow game delete when email_invites table does not exist
-- (e.g. migration 20260216000000 not applied). Clean up invites when present.
-- =============================================

CREATE OR REPLACE FUNCTION delete_game_email_invites()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.email_invites
  WHERE target_type = 'game' AND target_id = OLD.id;
  RETURN OLD;
EXCEPTION
  WHEN undefined_table THEN
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public;
