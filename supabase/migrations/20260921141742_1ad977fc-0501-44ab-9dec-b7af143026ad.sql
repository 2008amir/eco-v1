
CREATE OR REPLACE FUNCTION public.is_community_owner(_community_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = _community_id
      AND (
        c.created_by = _user_id
        OR ((c.created_by IS NULL OR c.is_general) AND public.has_role(_user_id, 'admin'::public.app_role))
      )
  );
$$;

DROP POLICY IF EXISTS "Community admins delete community" ON public.communities;
CREATE POLICY "Community owner deletes community"
ON public.communities FOR DELETE TO authenticated
USING (public.is_community_owner(id, auth.uid()));

-- Join every general community (there may be more than one)
CREATE OR REPLACE FUNCTION public.join_general_community(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE gid uuid;
BEGIN
  FOR gid IN SELECT id FROM public.communities WHERE is_general LOOP
    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (gid, _user_id, CASE WHEN public.has_role(_user_id, 'admin') THEN 'admin' ELSE 'member' END)
    ON CONFLICT (community_id, user_id) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_role_general_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE gid uuid;
BEGIN
  IF NEW.role <> 'admin' THEN RETURN NEW; END IF;
  FOR gid IN SELECT id FROM public.communities WHERE is_general LOOP
    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (gid, NEW.user_id, 'admin')
    ON CONFLICT (community_id, user_id) DO UPDATE SET role = 'admin';
  END LOOP;
  RETURN NEW;
END;
$$;

-- Admin-only helper: mark a community as general (or not) and backfill every user
CREATE OR REPLACE FUNCTION public.set_community_general(_community_id uuid, _general boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.communities SET is_general = _general WHERE id = _community_id;
  IF _general THEN
    INSERT INTO public.community_members (community_id, user_id, role)
    SELECT _community_id, p.id,
      CASE WHEN public.has_role(p.id, 'admin'::public.app_role) THEN 'admin' ELSE 'member' END
    FROM public.profiles p
    ON CONFLICT (community_id, user_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_community_general(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_community_general(uuid, boolean) TO authenticated;

-- Backfill: every existing user belongs to every general community; site admins as admins
INSERT INTO public.community_members (community_id, user_id, role)
SELECT c.id, p.id,
  CASE WHEN public.has_role(p.id, 'admin'::public.app_role) THEN 'admin' ELSE 'member' END
FROM public.communities c CROSS JOIN public.profiles p
WHERE c.is_general
ON CONFLICT (community_id, user_id) DO NOTHING;

UPDATE public.community_members cm
SET role = 'admin'
FROM public.communities c
WHERE cm.community_id = c.id AND c.is_general
  AND public.has_role(cm.user_id, 'admin'::public.app_role)
  AND cm.role <> 'admin';
