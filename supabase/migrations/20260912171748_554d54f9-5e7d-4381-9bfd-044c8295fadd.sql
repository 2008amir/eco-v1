CREATE OR REPLACE FUNCTION public.get_admin_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(array_agg(DISTINCT user_id), '{}'::uuid[]) FROM public.user_roles WHERE role = 'admin'::public.app_role;
$$;
REVOKE ALL ON FUNCTION public.get_admin_ids() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_ids() TO authenticated, service_role;