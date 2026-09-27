CREATE OR REPLACE FUNCTION public.get_my_auth_state()
RETURNS TABLE(profile jsonb, is_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    SELECT to_jsonb(p) || jsonb_build_object(
      'registration_payment_verified', EXISTS (
        SELECT 1 FROM public.payments py
        WHERE py.user_id = p.id AND py.kind = 'registration' AND py.status = 'verified'
      )
    ) FROM public.profiles p WHERE p.id = auth.uid()
  ) AS profile,
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role
  ) AS is_admin;
$$;