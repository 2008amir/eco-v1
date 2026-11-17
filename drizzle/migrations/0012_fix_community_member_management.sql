DROP POLICY IF EXISTS "Community admins add members" ON public.community_members;
CREATE POLICY "Community owners and admins add members" ON public.community_members
FOR INSERT TO authenticated
WITH CHECK (
  public.is_community_admin(community_id, auth.uid())
  OR public.is_community_owner(community_id, auth.uid())
);

DROP POLICY IF EXISTS "Leave community or admin removes" ON public.community_members;
CREATE POLICY "Leave community or owner removes" ON public.community_members
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_community_admin(community_id, auth.uid())
  OR public.is_community_owner(community_id, auth.uid())
);