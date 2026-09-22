
-- 1. remove seeded demo communities
DELETE FROM public.communities WHERE created_by IS NULL;

-- 2. general community
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS is_general BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS communities_one_general ON public.communities (is_general) WHERE is_general;

INSERT INTO public.communities (name, description, visibility, location, is_general, invite_code)
SELECT 'General Group',
       'The official Ecomedic Squad general group. Every member of the platform is here.',
       'public', 'Global', true, substr(md5(random()::text), 1, 8)
WHERE NOT EXISTS (SELECT 1 FROM public.communities WHERE is_general);

-- everyone in, site admins as community admins
CREATE OR REPLACE FUNCTION public.join_general_community(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE gid uuid;
BEGIN
  SELECT id INTO gid FROM public.communities WHERE is_general LIMIT 1;
  IF gid IS NULL THEN RETURN; END IF;
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (gid, _user_id, CASE WHEN public.has_role(_user_id, 'admin') THEN 'admin' ELSE 'member' END)
  ON CONFLICT (community_id, user_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.join_general_community(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.tg_profile_join_general()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.join_general_community(NEW.id); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS profiles_join_general ON public.profiles;
CREATE TRIGGER profiles_join_general AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profile_join_general();

CREATE OR REPLACE FUNCTION public.tg_role_general_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gid uuid;
BEGIN
  IF NEW.role <> 'admin' THEN RETURN NEW; END IF;
  SELECT id INTO gid FROM public.communities WHERE is_general LIMIT 1;
  IF gid IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.community_members (community_id, user_id, role) VALUES (gid, NEW.user_id, 'admin')
  ON CONFLICT (community_id, user_id) DO UPDATE SET role = 'admin';
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS user_roles_general_admin ON public.user_roles;
CREATE TRIGGER user_roles_general_admin AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_role_general_admin();

-- backfill existing users
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.join_general_community(r.id);
  END LOOP;
END $$;

-- 3. projects
CREATE TABLE IF NOT EXISTS public.community_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','cancelled')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.community_project_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.community_projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_projects TO authenticated;
GRANT ALL ON public.community_projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_project_reviews TO authenticated;
GRANT ALL ON public.community_project_reviews TO service_role;

ALTER TABLE public.community_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_project_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read active projects" ON public.community_projects
FOR SELECT TO authenticated
USING (
  (public.is_community_member(community_id, auth.uid()) AND status = 'active')
  OR public.is_community_admin(community_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Community admins create projects" ON public.community_projects
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (public.is_community_admin(community_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Community admins update projects" ON public.community_projects
FOR UPDATE TO authenticated
USING (public.is_community_admin(community_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Community admins delete projects" ON public.community_projects
FOR DELETE TO authenticated
USING (public.is_community_admin(community_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read reviews" ON public.community_project_reviews
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.community_projects p WHERE p.id = project_id
  AND (public.is_community_admin(p.community_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Admins write reviews" ON public.community_project_reviews
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.community_projects p WHERE p.id = project_id
  AND (public.is_community_admin(p.community_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Admins update reviews" ON public.community_project_reviews
FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete reviews" ON public.community_project_reviews
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
