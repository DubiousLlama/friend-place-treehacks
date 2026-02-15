-- Fix: infinite recursion in group_members RLS (policy checks group_members again).
-- Use a SECURITY DEFINER function so membership check bypasses RLS.

CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = gid AND player_id = uid);
$$;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;

-- Replace group_members policies to use the function (no self-reference).
DROP POLICY IF EXISTS "Members can read group_members" ON group_members;
CREATE POLICY "Members can read group_members"
  ON group_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM saved_groups sg
      WHERE sg.id = group_members.group_id
        AND (sg.owner_id = auth.uid() OR public.is_group_member(sg.id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owner or members can add group_members" ON group_members;
CREATE POLICY "Owner or members can add group_members"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM saved_groups sg
      WHERE sg.id = group_members.group_id
        AND (sg.owner_id = auth.uid()
             OR (sg.anyone_can_add_members AND public.is_group_member(sg.id, auth.uid())))
    )
  );

DROP POLICY IF EXISTS "Owner or permitted members can remove or leave" ON group_members;
CREATE POLICY "Owner or permitted members can remove or leave"
  ON group_members FOR DELETE TO authenticated
  USING (
    player_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM saved_groups sg
      WHERE sg.id = group_members.group_id
        AND (sg.owner_id = auth.uid()
             OR (NOT sg.only_admin_can_remove AND public.is_group_member(sg.id, auth.uid())))
    )
  );
