-- =============================================
-- RPC to soft-delete a game (set deleted_at).
-- Runs as SECURITY DEFINER so the UPDATE is not blocked by RLS;
-- only the creator can soft-delete (checked inside the function via auth.uid()).
-- =============================================

CREATE OR REPLACE FUNCTION public.soft_delete_game(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_by uuid;
BEGIN
  SELECT created_by INTO v_created_by
  FROM games
  WHERE id = p_game_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
  IF v_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the host can delete this game';
  END IF;

  UPDATE games
  SET deleted_at = now()
  WHERE id = p_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_game(uuid) TO authenticated;
