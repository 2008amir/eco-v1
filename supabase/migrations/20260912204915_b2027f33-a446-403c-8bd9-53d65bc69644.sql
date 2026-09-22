CREATE OR REPLACE FUNCTION public.is_community_owner(_community_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = _community_id
      AND (c.created_by = _user_id OR (c.created_by IS NULL AND public.has_role(_user_id, 'admin'::public.app_role)))
  );
$$;

DROP POLICY IF EXISTS "Community admins update roles" ON public.community_members;
CREATE POLICY "Community owner updates roles" ON public.community_members
FOR UPDATE TO authenticated
USING (public.is_community_owner(community_id, auth.uid()))
WITH CHECK (public.is_community_owner(community_id, auth.uid()));

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.community_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.communities; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.community_projects; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.community_join_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.community_members REPLICA IDENTITY FULL;
ALTER TABLE public.communities REPLICA IDENTITY FULL;
ALTER TABLE public.community_projects REPLICA IDENTITY FULL;
ALTER TABLE public.community_join_requests REPLICA IDENTITY FULL;