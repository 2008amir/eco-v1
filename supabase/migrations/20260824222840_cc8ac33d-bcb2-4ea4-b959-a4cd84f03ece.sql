
REVOKE ALL ON FUNCTION public.join_general_community(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_profile_join_general() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_role_general_admin() FROM PUBLIC, anon, authenticated;
