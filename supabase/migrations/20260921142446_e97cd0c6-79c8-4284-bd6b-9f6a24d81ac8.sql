CREATE OR REPLACE FUNCTION public.is_community_owner(_community_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = _community_id
      AND (
        c.created_by = _user_id
        OR ((c.created_by IS NULL OR c.is_general) AND public.has_role(_user_id, 'admin'::public.app_role))
        OR (c.created_by IS NOT NULL AND public.has_role(c.created_by, 'admin'::public.app_role) AND public.has_role(_user_id, 'admin'::public.app_role))
      )
  );
$function$;