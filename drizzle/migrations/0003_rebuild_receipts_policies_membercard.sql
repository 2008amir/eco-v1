CREATE POLICY "Users upload own receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users read own receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "Users update own receipts" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER TABLE public.profiles ADD COLUMN pending_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.admin_set_position(_user_id uuid, _position_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF (SELECT is_member FROM public.positions WHERE id = _position_id) THEN
    UPDATE public.profiles SET position_id = _position_id, position_pending = false, pending_position_id = NULL, updated_at = now() WHERE id = _user_id;
  ELSE
    UPDATE public.profiles SET position_pending = true, pending_position_id = _position_id, updated_at = now() WHERE id = _user_id;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_payment(_payment_id uuid, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO p FROM public.payments WHERE id = _payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  IF _action = 'verify' THEN
    UPDATE public.payments SET status = 'verified', reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now() WHERE id = _payment_id;
    IF p.kind = 'registration' THEN
      UPDATE public.profiles SET
        registered_at = coalesce(registered_at, now()),
        member_no = coalesce(member_no, 'ECS-' || lpad(nextval('public.member_no_seq')::text, 5, '0')),
        position_id = coalesce(position_id, (SELECT id FROM public.positions WHERE is_member LIMIT 1)),
        onboarding_step = 4,
        updated_at = now()
      WHERE id = p.user_id;
    ELSIF p.kind = 'position' THEN
      UPDATE public.profiles SET position_id = coalesce(p.position_id, pending_position_id), position_pending = false, pending_position_id = NULL, updated_at = now() WHERE id = p.user_id;
    END IF;
  ELSIF _action = 'reject' THEN
    UPDATE public.payments SET status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now() WHERE id = _payment_id;
    IF p.kind = 'registration' THEN
      UPDATE public.profiles SET onboarding_step = 2, updated_at = now() WHERE id = p.user_id;
    END IF;
  ELSIF _action = 'revoke' THEN
    UPDATE public.payments SET status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now() WHERE id = _payment_id;
    UPDATE public.profiles SET is_revoked = true, updated_at = now() WHERE id = p.user_id;
  ELSE
    RAISE EXCEPTION 'Invalid action';
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_set_position(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_payment(uuid, text) FROM anon;

CREATE TABLE public.org_policies (
  key text PRIMARY KEY,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.org_policies TO anon;
GRANT SELECT, INSERT, UPDATE ON public.org_policies TO authenticated;
GRANT ALL ON public.org_policies TO service_role;

ALTER TABLE public.org_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read policies" ON public.org_policies FOR SELECT USING (true);
CREATE POLICY "Admins can insert policies" ON public.org_policies FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update policies" ON public.org_policies FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_org_policies_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER org_policies_updated_at BEFORE UPDATE ON public.org_policies
FOR EACH ROW EXECUTE FUNCTION public.set_org_policies_updated_at();

INSERT INTO public.org_policies (key, content) VALUES
  ('form', ''),
  ('id_card', '')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.public_member_card(_member_no text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'member_no', p.member_no,
    'full_name', COALESCE(NULLIF(p.id_full_name, ''), concat_ws(' ', p.first_name, p.middle_name, p.last_name)),
    'first_name', p.first_name,
    'last_name', p.last_name,
    'middle_name', p.middle_name,
    'username', p.username,
    'blood_group', p.blood_group,
    'phone', COALESCE(NULLIF(p.id_phone, ''), p.phone),
    'gender', p.gender,
    'date_of_birth', p.date_of_birth,
    'city', p.city,
    'state', p.state,
    'country', p.country,
    'avatar_url', p.avatar_url,
    'position', COALESCE(pos.name, 'Member'),
    'registered_at', p.registered_at,
    'revoked', p.is_revoked
  )
  FROM public.profiles p
  LEFT JOIN public.positions pos ON pos.id = p.position_id
  WHERE p.member_no = _member_no
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.public_member_card(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_member_card(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';