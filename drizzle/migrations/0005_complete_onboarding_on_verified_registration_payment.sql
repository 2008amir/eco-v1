CREATE OR REPLACE FUNCTION public.admin_review_payment(_payment_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment public.payments%ROWTYPE;
  _member_position_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF _action NOT IN ('verify', 'reject') THEN
    RAISE EXCEPTION 'Invalid review action';
  END IF;

  SELECT * INTO _payment
  FROM public.payments
  WHERE id = _payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  UPDATE public.payments
  SET status = CASE WHEN _action = 'verify' THEN 'verified' ELSE 'rejected' END,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE id = _payment_id;

  IF _action = 'verify' AND _payment.kind = 'registration' THEN
    SELECT id INTO _member_position_id
    FROM public.positions
    WHERE is_member = true
    ORDER BY created_at
    LIMIT 1;

    UPDATE public.profiles
    SET registered_at = COALESCE(registered_at, now()),
        member_no = COALESCE(member_no, public.generate_member_no()),
        position_id = COALESCE(position_id, _member_position_id),
        onboarding_step = 6,
        updated_at = now()
    WHERE id = _payment.user_id;
  ELSIF _action = 'verify' AND _payment.kind = 'position' THEN
    UPDATE public.profiles
    SET position_id = COALESCE(_payment.position_id, position_id),
        position_pending = false,
        pending_position_id = null,
        updated_at = now()
    WHERE id = _payment.user_id;
  ELSIF _action = 'reject' AND _payment.kind = 'registration' THEN
    UPDATE public.profiles
    SET onboarding_step = 2,
        updated_at = now()
    WHERE id = _payment.user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_payment(uuid, text) TO service_role;