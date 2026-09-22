CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  username text UNIQUE NOT NULL,
  country text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  header_image_url text DEFAULT '',
  category text NOT NULL DEFAULT '',
  research_number text NOT NULL DEFAULT '',
  research_type text NOT NULL DEFAULT 'drugs',
  section text DEFAULT '',
  content_html text NOT NULL DEFAULT '',
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research TO authenticated;
GRANT ALL ON public.research TO service_role;
ALTER TABLE public.research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read research" ON public.research FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write research" ON public.research FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update research" ON public.research FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete research" ON public.research FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE SEQUENCE IF NOT EXISTS public.research_serial_seq START 1;
CREATE OR REPLACE FUNCTION public.set_research_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prefix text; next_n bigint;
BEGIN
  IF NEW.research_number IS NULL OR NEW.research_number = '' THEN
    prefix := CASE lower(coalesce(NEW.research_type, 'drugs'))
      WHEN 'disease' THEN 'Di' WHEN 'drugs' THEN 'Dr' WHEN 'drug' THEN 'Dr'
      WHEN 'discovery' THEN 'Dv' ELSE 'Dr' END;
    next_n := nextval('public.research_serial_seq');
    NEW.research_number := 'ESR-' || prefix || '-' || lpad(next_n::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_set_research_number BEFORE INSERT ON public.research
  FOR EACH ROW EXECUTE FUNCTION public.set_research_number();

CREATE TABLE public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  research_id uuid NOT NULL REFERENCES public.research(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, research_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes readable" ON public.likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like" ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike" ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  research_id uuid NOT NULL REFERENCES public.research(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments readable" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users comment" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, comment_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_likes TO authenticated;
GRANT ALL ON public.comment_likes TO service_role;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment likes readable" ON public.comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like comment" ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike comment" ON public.comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.saved_research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  research_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, research_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_research TO authenticated;
GRANT ALL ON public.saved_research TO service_role;
ALTER TABLE public.saved_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own saves" ON public.saved_research FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users save research" ON public.saved_research FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unsave research" ON public.saved_research FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content text,
  file_url text,
  file_type text,
  file_name text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_pair ON public.messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_messages_recipient ON public.messages (recipient_id, read_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own messages" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Recipients mark read" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id OR public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
END $$;

CREATE TABLE public.active_days (
  user_id uuid NOT NULL,
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT, INSERT ON public.active_days TO authenticated;
GRANT ALL ON public.active_days TO service_role;
ALTER TABLE public.active_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users record own activity" ON public.active_days FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users see own activity" ON public.active_days FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_my_auth_state()
RETURNS TABLE(profile jsonb, is_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = auth.uid()) AS profile,
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role) AS is_admin;
$$;

CREATE OR REPLACE FUNCTION public.record_my_activity()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.active_days (user_id, day) VALUES (auth.uid(), (now() AT TIME ZONE 'UTC')::date)
  ON CONFLICT (user_id, day) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result jsonb;
  today date := (now() AT TIME ZONE 'UTC')::date;
  week_ago date := today - INTERVAL '6 days';
  month_ago date := today - INTERVAL '29 days';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'research', (SELECT count(*) FROM public.research),
    'likes', (SELECT count(*) FROM public.likes),
    'comments', (SELECT count(*) FROM public.comments),
    'dailyActive', (SELECT count(DISTINCT user_id) FROM public.active_days WHERE day = today),
    'weeklyActive', (SELECT count(DISTINCT user_id) FROM public.active_days WHERE day >= week_ago),
    'monthlyActive', (SELECT count(DISTINCT user_id) FROM public.active_days WHERE day >= month_ago),
    'last7', (
      SELECT jsonb_agg(jsonb_build_object('day', d::text, 'count', coalesce(c.cnt, 0)) ORDER BY d)
      FROM generate_series(today - INTERVAL '6 days', today, INTERVAL '1 day') AS d
      LEFT JOIN (SELECT day, count(DISTINCT user_id) AS cnt FROM public.active_days WHERE day >= week_ago GROUP BY day) c
        ON c.day = d::date
    )
  ) INTO result;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.get_active_history(period text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF period = 'daily' THEN
    SELECT jsonb_agg(jsonb_build_object('bucket', day::text, 'count', cnt) ORDER BY day DESC) INTO result
    FROM (SELECT day, count(DISTINCT user_id) AS cnt FROM public.active_days GROUP BY day) s;
  ELSIF period = 'weekly' THEN
    SELECT jsonb_agg(jsonb_build_object('bucket', to_char(wk, 'IYYY-"W"IW'), 'start', wk::text, 'count', cnt) ORDER BY wk DESC) INTO result
    FROM (SELECT date_trunc('week', day)::date AS wk, count(DISTINCT user_id) AS cnt FROM public.active_days GROUP BY date_trunc('week', day)) s;
  ELSIF period = 'monthly' THEN
    SELECT jsonb_agg(jsonb_build_object('bucket', to_char(mo, 'YYYY-MM'), 'start', mo::text, 'count', cnt) ORDER BY mo DESC) INTO result
    FROM (SELECT date_trunc('month', day)::date AS mo, count(DISTINCT user_id) AS cnt FROM public.active_days GROUP BY date_trunc('month', day)) s;
  ELSE
    RAISE EXCEPTION 'Invalid period';
  END IF;
  RETURN coalesce(result, '[]'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.get_user_detail(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = _user_id),
    'totalLikes', (SELECT count(*) FROM public.likes WHERE user_id = _user_id),
    'totalComments', (SELECT count(*) FROM public.comments WHERE user_id = _user_id),
    'comments', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'content', c.content, 'created_at', c.created_at,
        'research_id', c.research_id, 'research_title', r.title) ORDER BY c.created_at DESC), '[]'::jsonb)
      FROM public.comments c LEFT JOIN public.research r ON r.id = c.research_id WHERE c.user_id = _user_id
    )
  ) INTO result;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.get_any_admin_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.user_roles WHERE role = 'admin'::public.app_role ORDER BY created_at ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(trim(_username)));
$$;

CREATE OR REPLACE FUNCTION public.get_email_for_username(_username text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE user_email text; uid uuid;
BEGIN
  SELECT id INTO uid FROM public.profiles WHERE lower(username) = lower(trim(_username)) LIMIT 1;
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = uid LIMIT 1;
  RETURN user_email;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username text; candidate text; suffix_len int := 4; attempt int := 0;
BEGIN
  base_username := nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), '');
  IF base_username IS NULL THEN base_username := split_part(coalesce(new.email, 'user'), '@', 1); END IF;
  base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
  IF base_username = '' THEN base_username := 'user'; END IF;
  candidate := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    attempt := attempt + 1;
    candidate := base_username || '_' || substr(replace(new.id::text, '-', ''), 1, suffix_len + attempt);
    IF attempt > 8 THEN
      candidate := base_username || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
      EXIT;
    END IF;
  END LOOP;
  INSERT INTO public.profiles (id, first_name, last_name, username, country, phone)
  VALUES (new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    candidate,
    coalesce(new.raw_user_meta_data->>'country', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user') ON CONFLICT DO NOTHING;
  RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.grant_admin_for_special_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email = 'ecomedicsquad@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_admin AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_special_email();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_admin_for_special_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_research_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_auth_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_my_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_history(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_any_admin_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_for_username(text) TO anon, authenticated;

CREATE POLICY "Avatars read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Avatars user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Avatars user update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Avatars user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Research images read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'research-images');
CREATE POLICY "Research images admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'research-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Research images admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'research-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Research images admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'research-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Research media read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'research-media');
CREATE POLICY "Research media admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'research-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Research media admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'research-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Research media admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'research-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Chat files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-files');
CREATE POLICY "Chat files user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Chat files user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-files' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::public.app_role)));