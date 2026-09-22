REVOKE ALL ON FUNCTION public.get_my_auth_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_my_activity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_active_history(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_any_admin_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_research_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_for_special_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_username_available(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_email_for_username(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_auth_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_my_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_history(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_any_admin_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_for_username(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';