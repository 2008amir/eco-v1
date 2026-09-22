
-- ============ COMMUNITIES ============
CREATE TABLE public.communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  location TEXT,
  active_projects INTEGER NOT NULL DEFAULT 0,
  invite_code TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX communities_invite_code_key ON public.communities(invite_code);

CREATE TABLE public.community_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

CREATE TABLE public.community_join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

CREATE TABLE public.community_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX community_messages_community_idx ON public.community_messages(community_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_join_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_messages TO authenticated;
GRANT ALL ON public.communities TO service_role;
GRANT ALL ON public.community_members TO service_role;
GRANT ALL ON public.community_join_requests TO service_role;
GRANT ALL ON public.community_messages TO service_role;

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.is_community_member(_community_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = _community_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_community_admin(_community_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = _community_id AND user_id = _user_id AND role = 'admin');
$$;

REVOKE ALL ON FUNCTION public.is_community_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_community_admin(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_community_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_admin(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_community_creator_as_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT (community_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER communities_creator_admin AFTER INSERT ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.add_community_creator_as_admin();

CREATE OR REPLACE FUNCTION public.set_updated_at_communities()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER communities_updated_at BEFORE UPDATE ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_communities();

-- Approving a join request adds the member
CREATE OR REPLACE FUNCTION public.apply_join_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND COALESCE(OLD.status, '') <> 'approved' THEN
    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (NEW.community_id, NEW.user_id, 'member')
    ON CONFLICT (community_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER community_join_requests_apply AFTER UPDATE ON public.community_join_requests
FOR EACH ROW EXECUTE FUNCTION public.apply_join_request();

-- ============ RLS ============
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Communities viewable by authenticated" ON public.communities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create communities" ON public.communities
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Community admins update community" ON public.communities
  FOR UPDATE TO authenticated USING (public.is_community_admin(id, auth.uid()));
CREATE POLICY "Community admins delete community" ON public.communities
  FOR DELETE TO authenticated USING (public.is_community_admin(id, auth.uid()));

CREATE POLICY "Members visible to members" ON public.community_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_community_member(community_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.visibility = 'public')
  );
CREATE POLICY "Join public communities" ON public.community_members
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND role = 'member'
    AND EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.visibility = 'public')
  );
CREATE POLICY "Community admins add members" ON public.community_members
  FOR INSERT TO authenticated WITH CHECK (public.is_community_admin(community_id, auth.uid()));
CREATE POLICY "Community admins update roles" ON public.community_members
  FOR UPDATE TO authenticated USING (public.is_community_admin(community_id, auth.uid()));
CREATE POLICY "Leave community or admin removes" ON public.community_members
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_community_admin(community_id, auth.uid()));

CREATE POLICY "Own or admin join requests visible" ON public.community_join_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_community_admin(community_id, auth.uid()));
CREATE POLICY "Request to join" ON public.community_join_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Community admins resolve requests" ON public.community_join_requests
  FOR UPDATE TO authenticated USING (public.is_community_admin(community_id, auth.uid()));
CREATE POLICY "Cancel own request or admin" ON public.community_join_requests
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_community_admin(community_id, auth.uid()));

CREATE POLICY "Members read community chat" ON public.community_messages
  FOR SELECT TO authenticated USING (public.is_community_member(community_id, auth.uid()));
CREATE POLICY "Members send community chat" ON public.community_messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_community_member(community_id, auth.uid()));
CREATE POLICY "Delete own or admin community chat" ON public.community_messages
  FOR DELETE TO authenticated USING (sender_id = auth.uid() OR public.is_community_admin(community_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
ALTER TABLE public.community_messages REPLICA IDENTITY FULL;

-- ============ SEED ============
INSERT INTO public.communities (name, description, visibility, location, active_projects) VALUES
('Ecomedic Health Community', 'A network of healthcare professionals, students, researchers and innovators working together to improve health knowledge and community wellbeing.', 'public', 'Nigeria', 4),
('Youth Innovation Network', 'Young innovators building practical solutions for health, education and community development challenges.', 'public', 'Africa', 3),
('Research & Science Community', 'Researchers sharing findings, methodology and peer review across medical and environmental science.', 'public', 'Global', 6),
('Healthcare Professionals Network', 'Doctors, nurses, pharmacists and allied health workers exchanging clinical insight and best practice.', 'private', 'Global', 2),
('Technology & AI Community', 'Builders applying software, data and AI to healthcare and scientific research problems.', 'public', 'Remote', 5),
('Environmental Action Community', 'Volunteers and specialists driving environmental health, sanitation and climate resilience projects.', 'public', 'West Africa', 3);
