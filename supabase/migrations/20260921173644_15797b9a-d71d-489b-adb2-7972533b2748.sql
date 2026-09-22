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