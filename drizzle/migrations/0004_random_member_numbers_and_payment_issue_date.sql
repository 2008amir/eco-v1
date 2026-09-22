CREATE OR REPLACE FUNCTION public.generate_member_no()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  candidate text;
  first_part text;
  second_part text;
  i integer;
BEGIN
  LOOP
    first_part := '';
    second_part := '';
    FOR i IN 1..4 LOOP
      first_part := first_part || substr(alphabet, floor(random() * length(alphabet))::integer + 1, 1);
      second_part := second_part || substr(alphabet, floor(random() * length(alphabet))::integer + 1, 1);
    END LOOP;
    candidate := 'EMS/' || first_part || '/' || second_part;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE member_no = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_member_no() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_member_no() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_review_payment(_payment_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        member_no = coalesce(member_no, public.generate_member_no()),
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
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_payment(uuid, text) TO authenticated, service_role;

COMMENT ON SEQUENCE public.member_no_seq IS 'DEPRECATED: member numbers now use random EMS/AB12/CD34 values generated after registration payment verification.';