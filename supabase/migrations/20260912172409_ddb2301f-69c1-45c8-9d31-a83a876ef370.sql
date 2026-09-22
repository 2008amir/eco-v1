ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS members_can_post boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Members can send community messages" ON public.community_messages;
DROP POLICY IF EXISTS "Members send messages" ON public.community_messages;

CREATE POLICY "Allowed members can send community messages"
ON public.community_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_community_member(community_id, auth.uid())
  AND (
    public.is_community_admin(community_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.members_can_post)
  )
);