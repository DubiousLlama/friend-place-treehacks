-- =============================================
-- RPC to check game invite status without needing service role.
-- Returns 'not_found' | 'deleted' | 'active' so the play page can show
-- "This game has been deleted" vs "Game not found".
-- =============================================

CREATE OR REPLACE FUNCTION public.check_game_invite_status(p_invite_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_at timestamptz;
BEGIN
  SELECT deleted_at INTO v_deleted_at
  FROM games
  WHERE invite_code = p_invite_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_deleted_at IS NOT NULL THEN
    RETURN 'deleted';
  END IF;
  RETURN 'active';
END;
$$;

-- Callable by anon and authenticated (no sensitive data exposed)
GRANT EXECUTE ON FUNCTION public.check_game_invite_status(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_game_invite_status(text) TO authenticated;
