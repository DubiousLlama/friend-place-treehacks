-- =============================================
-- Fix: trigger "relation email_invites does not exist"
-- SECURITY DEFINER functions can run with restricted search_path;
-- qualify table and set search_path so the relation is found.
-- =============================================

CREATE OR REPLACE FUNCTION delete_game_email_invites()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.email_invites
  WHERE target_type = 'game' AND target_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public;
