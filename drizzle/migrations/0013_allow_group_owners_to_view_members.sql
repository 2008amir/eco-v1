DROP POLICY IF EXISTS "Members visible to members" ON public.community_members;
CREATE POLICY "Members visible to members and owners" ON public.community_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_community_member(community_id, auth.uid())
  OR public.is_community_owner(community_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_members.community_id AND c.visibility = 'public'
  )
);