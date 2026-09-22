
-- POSITIONS
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  is_member boolean NOT NULL DEFAULT false,
  reg_amount numeric NOT NULL DEFAULT 0,
  monthly_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Positions readable by authenticated" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage positions" ON public.positions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.positions (name, description, is_member, reg_amount, monthly_amount)
VALUES ('Member', 'Regular member of Ecomedic Squad.', true, 0, 0);

-- PAYMENT ACCOUNT (single recipient account)
CREATE TABLE public.payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO authenticated;
GRANT ALL ON public.payment_accounts TO service_role;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account readable by authenticated" ON public.payment_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage account" ON public.payment_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- PAYMENTS
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'registration',
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  receipt_url text,
  period text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  CONSTRAINT payments_kind_check CHECK (kind IN ('registration','monthly','position')),
  CONSTRAINT payments_status_check CHECK (status IN ('pending','verified','rejected'))
);
CREATE INDEX payments_user_idx ON public.payments (user_id, kind, created_at DESC);
CREATE INDEX payments_status_idx ON public.payments (status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own payments" ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users create own payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins update payments" ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete payments" ON public.payments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- PROFILE ADDITIONS
ALTER TABLE public.profiles
  ADD COLUMN position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  ADD COLUMN member_no text UNIQUE,
  ADD COLUMN onboarding_step integer NOT NULL DEFAULT 0,
  ADD COLUMN policy_accepted_at timestamptz,
  ADD COLUMN registered_at timestamptz,
  ADD COLUMN is_revoked boolean NOT NULL DEFAULT false,
  ADD COLUMN position_pending boolean NOT NULL DEFAULT false;

CREATE SEQUENCE IF NOT EXISTS public.member_no_seq START 1;

-- Admin can update any profile (position changes, revocation)
CREATE POLICY "Admins update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- REVIEW PAYMENT
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
      UPDATE public.profiles SET position_id = p.position_id, position_pending = false, updated_at = now() WHERE id = p.user_id;
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

-- PROMOTE
CREATE OR REPLACE FUNCTION public.admin_set_position(_user_id uuid, _position_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF (SELECT is_member FROM public.positions WHERE id = _position_id) THEN
    UPDATE public.profiles SET position_id = _position_id, position_pending = false, updated_at = now() WHERE id = _user_id;
  ELSE
    UPDATE public.profiles SET position_pending = true, updated_at = now() WHERE id = _user_id;
    INSERT INTO public.payments (user_id, kind, position_id, amount, status)
    VALUES (_user_id, 'position', _position_id, (SELECT reg_amount FROM public.positions WHERE id = _position_id), 'pending')
    ON CONFLICT DO NOTHING;
  END IF;
END; $$;

-- REVOKE / RESTORE USER
CREATE OR REPLACE FUNCTION public.admin_set_revoked(_user_id uuid, _revoked boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.profiles SET is_revoked = _revoked, updated_at = now() WHERE id = _user_id;
END; $$;

-- ADMIN LISTS
CREATE OR REPLACE FUNCTION public.admin_pending_payments(_kind text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', pay.id, 'user_id', pay.user_id, 'kind', pay.kind, 'amount', pay.amount,
    'receipt_url', pay.receipt_url, 'period', pay.period, 'created_at', pay.created_at,
    'position_name', pos.name,
    'first_name', pr.first_name, 'last_name', pr.last_name, 'username', pr.username, 'phone', pr.phone
  ) ORDER BY pay.created_at DESC), '[]'::jsonb) INTO result
  FROM public.payments pay
  LEFT JOIN public.profiles pr ON pr.id = pay.user_id
  LEFT JOIN public.positions pos ON pos.id = coalesce(pay.position_id, pr.position_id)
  WHERE pay.status = 'pending' AND (_kind IS NULL OR pay.kind = _kind);
  RETURN result;
END; $$;
