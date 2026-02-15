-- Fix: infinite recursion in saved_groups RLS (SELECT/UPDATE reference group_members,
-- and group_members RLS references saved_groups). Use SECURITY DEFINER so membership
-- check bypasses RLS and does not re-enter saved_groups.

CREATE OR REPLACE FUNCTION public.user_can_read_saved_group(gid uuid, oid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT oid = auth.uid()
     OR EXISTS (SELECT 1 FROM public.group_members WHERE group_id = gid AND player_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.user_can_read_saved_group(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Members can read groups they belong to" ON saved_groups;
CREATE POLICY "Members can read groups they belong to"
  ON saved_groups FOR SELECT TO authenticated
  USING (public.user_can_read_saved_group(id, owner_id));

DROP POLICY IF EXISTS "Members can update group" ON saved_groups;
CREATE POLICY "Members can update group"
  ON saved_groups FOR UPDATE TO authenticated
  USING (public.user_can_read_saved_group(id, owner_id));
