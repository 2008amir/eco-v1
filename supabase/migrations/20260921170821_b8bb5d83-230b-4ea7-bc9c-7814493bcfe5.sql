
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
