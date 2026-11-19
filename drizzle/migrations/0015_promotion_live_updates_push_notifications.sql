CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.admin_set_position(_user_id uuid, _position_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_member boolean; _amount numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT is_member, reg_amount INTO _is_member, _amount FROM public.positions WHERE id = _position_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Position not found'; END IF;
  IF _is_member OR coalesce(_amount, 0) <= 0 THEN
    UPDATE public.profiles SET position_id = _position_id, position_pending = false, pending_position_id = NULL, updated_at = now() WHERE id = _user_id;
  ELSE
    UPDATE public.profiles SET position_id = _position_id, position_pending = true, pending_position_id = _position_id, updated_at = now() WHERE id = _user_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_position(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_position(uuid, uuid) TO authenticated;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '/',
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own subs read" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own subs insert" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own subs update" ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own subs delete" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.push_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  endpoint_url text NOT NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex')
);
REVOKE ALL ON public.push_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.push_config TO service_role;
ALTER TABLE public.push_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.push_config (endpoint_url) VALUES ('https://workes.ecomedic.me/api/public/push/send');

CREATE OR REPLACE FUNCTION public.tg_notification_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cfg public.push_config%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;
  SELECT * INTO _cfg FROM public.push_config LIMIT 1;
  IF FOUND THEN
    BEGIN
      PERFORM net.http_post(
        url := _cfg.endpoint_url,
        body := jsonb_build_object('id', NEW.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-token', _cfg.token)
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER notifications_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.tg_notification_push();

CREATE OR REPLACE FUNCTION public.claim_push(_id uuid, _token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n public.notifications%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_config WHERE token = _token) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.notifications SET pushed_at = now() WHERE id = _id AND pushed_at IS NULL RETURNING * INTO _n;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('title', _n.title, 'body', _n.body, 'url', _n.url, 'tag', _n.kind,
    'subscriptions', coalesce((SELECT jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
      FROM public.push_subscriptions s WHERE s.user_id = _n.user_id), '[]'::jsonb));
END; $$;
CREATE OR REPLACE FUNCTION public.drop_push_subscription(_endpoint text, _token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_config WHERE token = _token) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.push_subscriptions WHERE endpoint = _endpoint;
END; $$;
REVOKE ALL ON FUNCTION public.claim_push(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.drop_push_subscription(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_push(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.drop_push_subscription(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_notify_research()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _label text; _path text;
BEGIN
  _label := CASE NEW.post_kind WHEN 'news' THEN 'News' WHEN 'project' THEN 'New project' WHEN 'broadcast' THEN 'Broadcast' ELSE 'New research' END;
  _path := CASE NEW.post_kind WHEN 'news' THEN '/news/' || NEW.id WHEN 'project' THEN '/project/' || NEW.id WHEN 'broadcast' THEN '/broadcast' ELSE '/research/' || NEW.id END;
  INSERT INTO public.notifications (user_id, kind, title, body, url)
  SELECT p.id, NEW.post_kind, _label || ': ' || NEW.title, left(coalesce(NEW.description, ''), 160), _path
  FROM public.profiles p WHERE p.id IS DISTINCT FROM NEW.author_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER research_notify AFTER INSERT ON public.research FOR EACH ROW EXECUTE FUNCTION public.tg_notify_research();

CREATE OR REPLACE FUNCTION public.tg_notify_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  SELECT coalesce(nullif(trim(first_name || ' ' || coalesce(last_name, '')), ''), username) INTO _name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, kind, title, body, url)
  VALUES (NEW.recipient_id, 'chat', 'New message from ' || coalesce(_name, 'someone'),
    coalesce(left(NEW.content, 160), CASE WHEN NEW.file_url IS NOT NULL THEN 'Sent a file' ELSE '' END), '/chat');
  RETURN NEW;
END; $$;
CREATE TRIGGER messages_notify AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.tg_notify_message();

CREATE OR REPLACE FUNCTION public.tg_notify_community_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cname text;
BEGIN
  SELECT name INTO _cname FROM public.communities WHERE id = NEW.community_id;
  INSERT INTO public.notifications (user_id, kind, title, body, url)
  SELECT m.user_id, 'community', coalesce(_cname, 'Community') || ': new message',
    coalesce(left(NEW.content, 160), 'Shared a file'), '/community/' || NEW.community_id
  FROM public.community_members m WHERE m.community_id = NEW.community_id AND m.user_id <> NEW.sender_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER community_messages_notify AFTER INSERT ON public.community_messages FOR EACH ROW EXECUTE FUNCTION public.tg_notify_community_message();

CREATE OR REPLACE FUNCTION public.tg_notify_community_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cname text;
BEGIN
  SELECT name INTO _cname FROM public.communities WHERE id = NEW.community_id;
  INSERT INTO public.notifications (user_id, kind, title, body, url)
  SELECT m.user_id, 'community', coalesce(_cname, 'Community') || ': new project ' || NEW.name,
    left(NEW.description, 160), '/community-projects/' || NEW.id
  FROM public.community_members m WHERE m.community_id = NEW.community_id AND m.user_id <> NEW.created_by;
  RETURN NEW;
END; $$;
CREATE TRIGGER community_projects_notify AFTER INSERT ON public.community_projects FOR EACH ROW EXECUTE FUNCTION public.tg_notify_community_project();

CREATE OR REPLACE FUNCTION public.tg_notify_pending_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF NEW.status <> 'pending' OR NEW.kind NOT IN ('registration', 'monthly', 'position') THEN RETURN NEW; END IF;
  SELECT coalesce(nullif(trim(first_name || ' ' || coalesce(last_name, '')), ''), username) INTO _name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body, url)
  SELECT r.user_id, 'admin-payment',
    CASE NEW.kind WHEN 'monthly' THEN 'Monthly payment awaiting verification' ELSE 'Registration payment awaiting verification' END,
    coalesce(_name, 'A member') || ' paid ' || NEW.amount::text,
    CASE NEW.kind WHEN 'monthly' THEN '/admin/month-revenue' ELSE '/admin/reg-revenue' END
  FROM public.user_roles r WHERE r.role = 'admin';
  RETURN NEW;
END; $$;
CREATE TRIGGER payments_notify_admins AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tg_notify_pending_payment();

CREATE OR REPLACE FUNCTION public.send_monthly_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _period text := to_char(now(), 'YYYY-MM');
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, url)
  SELECT p.id, 'monthly', 'Monthly dues reminder', 'Your monthly dues for ' || _period || ' are due. Tap to pay.', '/monthly-payment'
  FROM public.profiles p
  WHERE p.registered_at IS NOT NULL AND NOT p.is_revoked
    AND NOT EXISTS (SELECT 1 FROM public.payments pay WHERE pay.user_id = p.id AND pay.kind = 'monthly' AND pay.period = _period AND pay.status IN ('pending', 'verified'));
END; $$;
REVOKE ALL ON FUNCTION public.send_monthly_reminders() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['research','payments','profiles','comments','likes','comment_likes','saved_research','positions','notifications','community_project_reviews','org_policies','user_roles','payment_accounts','active_days']
  LOOP
    BEGIN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END $$;